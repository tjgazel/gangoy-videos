import { bancoAberto, obterBanco } from "../banco/banco.js";
import { lerConfiguracaoApp } from "../nucleo/configuracaoApp.js";

// Configurações do sistema guardadas no banco da workspace (chave/valor).
export type ChaveConfiguracao =
  | "modelo_principal"
  | "modelo_leve"
  | "contexto_trabalho"
  | "amostras_fator_tokens"
  | "youtube_client_id"
  | "youtube_client_secret";

export const CONTEXTO_TRABALHO_PADRAO = 32768;

export function lerConfiguracao(chave: ChaveConfiguracao): string | null {
  // Sem workspace aberta (ex.: npm run teste:ollama fora dela) valem os padrões.
  if (!bancoAberto()) return null;
  const linha = obterBanco().prepare("SELECT valor FROM configuracoes WHERE chave = ?").get(chave) as
    | { valor: string }
    | undefined;
  return linha?.valor ?? null;
}

export function salvarConfiguracao(chave: ChaveConfiguracao, valor: string): void {
  obterBanco()
    .prepare(`
      INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
      ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em
    `)
    .run(chave, valor, new Date().toISOString());
}

export function obterConfiguracoesSistema(): {
  modeloPrincipal: string;
  modeloLeve: string;
  contextoTrabalho: number;
} {
  const { ollama } = lerConfiguracaoApp();
  return {
    modeloPrincipal: lerConfiguracao("modelo_principal") || ollama.modeloPadrao,
    modeloLeve: lerConfiguracao("modelo_leve") || ollama.modeloLeve,
    contextoTrabalho: Number(lerConfiguracao("contexto_trabalho")) || CONTEXTO_TRABALHO_PADRAO,
  };
}
