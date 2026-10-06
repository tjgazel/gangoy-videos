import { bancoAberto } from "../banco/banco.js";
import { lerConfiguracao, salvarConfiguracao } from "../configuracoes/sistema.js";
import { ErroAplicacao } from "../nucleo/erros.js";

// Proteção do contexto: o Ollama corta o começo do pedido sem avisar quando ele não cabe no num_ctx.

export type TipoChamada = "roteiro" | "refazer" | "planejamento" | "continuidade" | "proposta_dossie";

// Espaço guardado para a resposta (vai também em num_predict).
export const RESERVA_RESPOSTA: Record<TipoChamada, number> = {
  roteiro: 6000,
  refazer: 6000,
  planejamento: 4000,
  continuidade: 2000,
  proposta_dossie: 2000,
};

const FATOR_INICIAL = 3.0; // caracteres por token, conservador para pt-BR
const FATOR_MINIMO = 2.0;
const FATOR_MAXIMO = 5.0;
const MAXIMO_AMOSTRAS = 20;

export class ErroContextoInsuficiente extends ErroAplicacao {
  constructor(
    public tokensNecessarios: number,
    public numCtx: number,
  ) {
    super(
      `O pedido precisa de ~${tokensNecessarios.toLocaleString("pt-BR")} tokens e o contexto de trabalho é ${numCtx.toLocaleString("pt-BR")}. Aumente o contexto em Configurações ou escolha um modelo com contexto maior.`,
      422,
    );
    this.name = "ErroContextoInsuficiente";
  }
}

export function estimarTokens(caracteres: number, fator: number): number {
  return Math.ceil(caracteres / fator);
}

function lerAmostras(): number[] {
  if (!bancoAberto()) return [];
  try {
    const amostras = JSON.parse(lerConfiguracao("amostras_fator_tokens") ?? "[]");
    return Array.isArray(amostras) ? amostras.filter((valor) => typeof valor === "number") : [];
  } catch {
    return [];
  }
}

export function obterFatorTokens(): number {
  const amostras = lerAmostras();
  if (amostras.length === 0) return FATOR_INICIAL;
  const media = amostras.reduce((total, valor) => total + valor, 0) / amostras.length;
  return Math.min(FATOR_MAXIMO, Math.max(FATOR_MINIMO, media));
}

// Guarda a relação real caracteres/token das últimas chamadas, para estimar melhor as próximas.
export function registrarAmostraTokens(caracteres: number, tokensReais: number): void {
  if (!bancoAberto() || tokensReais <= 0) return;
  const amostras = [...lerAmostras(), caracteres / tokensReais].slice(-MAXIMO_AMOSTRAS);
  salvarConfiguracao("amostras_fator_tokens", JSON.stringify(amostras));
}
