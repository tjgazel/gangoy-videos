import { z } from "zod";
import { obterConfiguracoesSistema } from "../configuracoes/sistema.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { formatarProblema } from "../nucleo/mensagensValidacao.js";
import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";
import {
  ErroContextoInsuficiente,
  RESERVA_RESPOSTA,
  estimarTokens,
  obterFatorTokens,
  registrarAmostraTokens,
  type TipoChamada,
} from "./contexto.js";
import { contextoMaximoDoModelo } from "./modelos.js";

export interface Mensagem {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MedicaoContexto {
  modelo: string;
  numCtx: number;
  tokensEstimados: number;
  tokensPrompt: number;
  tokensResposta: number;
  possivelCorte: boolean;
  percentualCpu: number | null;
  duracaoSegundos: number;
}

// Última fração do modelo rodando na CPU, medida depois de cada chamada.
const usoCpu = new Map<string, number | null>();

export function ultimoPercentualCpu(modelo: string): number | null {
  return usoCpu.get(modelo) ?? null;
}

// O que o Ollama realmente carregou: fração na CPU e contexto (o /api/ps mostra o contexto efetivo, que pode
// ser menor que o pedido).
async function medirCarga(url: string, modelo: string): Promise<{ percentualCpu: number | null; contextoCarregado: number | null }> {
  try {
    const resposta = await fetch(`${url}/api/ps`, { signal: AbortSignal.timeout(3000) });
    const dados = (await resposta.json()) as { models?: { name: string; size: number; size_vram: number; context_length?: number }[] };
    const carregado = dados.models?.find((m) => m.name === modelo);
    if (!carregado) return { percentualCpu: null, contextoCarregado: null };
    return {
      percentualCpu: carregado.size ? Math.round((1 - carregado.size_vram / carregado.size) * 100) : null,
      contextoCarregado: carregado.context_length ?? null,
    };
  } catch {
    return { percentualCpu: null, contextoCarregado: null };
  }
}

// Resposta em pedaços (uma linha JSON por pedaço). Com stream, o Ollama manda dados durante a geração
// e o limite de espera do fetch não derruba gerações longas (modelo grande, parte na CPU).
async function lerRespostaEmPartes(
  resposta: Response,
): Promise<{ conteudo: string; tokensPrompt: number; tokensResposta: number }> {
  const leitor = resposta.body!.getReader();
  const decodificador = new TextDecoder();
  let pendente = "";
  let conteudo = "";
  let tokensPrompt = 0;
  let tokensResposta = 0;
  const processarLinha = (linha: string) => {
    if (!linha.trim()) return;
    const parte = JSON.parse(linha) as {
      message?: { content?: string };
      done?: boolean;
      error?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    if (parte.error) throw new ErroAplicacao(`O Ollama respondeu com erro: ${parte.error}`, 503);
    conteudo += parte.message?.content ?? "";
    if (parte.done) {
      tokensPrompt = parte.prompt_eval_count ?? 0;
      tokensResposta = parte.eval_count ?? 0;
    }
  };
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    pendente += decodificador.decode(value, { stream: true });
    const linhas = pendente.split("\n");
    pendente = linhas.pop() ?? "";
    linhas.forEach(processarLinha);
  }
  processarLinha(pendente + decodificador.decode());
  return { conteudo, tokensPrompt, tokensResposta };
}

function ehCancelamento(erro: unknown): boolean {
  const nome = (erro as { name?: string })?.name;
  return nome === "AbortError" || nome === "TimeoutError";
}

// Chama o Ollama pedindo JSON que obedece ao esquema Zod, sempre com num_ctx informado.
// Se a resposta não validar, devolve o erro ao modelo e tenta de novo.
export async function gerarJsonIa<T extends z.ZodType>(
  modelo: string,
  mensagens: Mensagem[],
  esquema: T,
  opcoes: { tipo: TipoChamada; sinal?: AbortSignal; tentativas?: number },
): Promise<{ dados: z.infer<T>; medicao: MedicaoContexto }> {
  const urlBase = obterOpcoesExecucao().urlOllama;
  const url = `${urlBase}/api/chat`;
  const formato = z.toJSONSchema(esquema);
  // O Ollama reduz em silêncio o num_ctx ao máximo do modelo; usar o valor real mantém a proteção do contexto honesta.
  const maximoModelo = await contextoMaximoDoModelo(modelo);
  const numCtx = Math.min(obterConfiguracoesSistema().contextoTrabalho, maximoModelo ?? Infinity);
  const reserva = RESERVA_RESPOSTA[opcoes.tipo];
  const tentativas = opcoes.tentativas ?? 3;
  const historico: Mensagem[] = [...mensagens];
  const inicio = performance.now();
  let ultimoErro = "";

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    // Confere a cada tentativa: o reenvio com o erro aumenta o histórico.
    const caracteres = historico.reduce((total, mensagem) => total + mensagem.content.length, 0);
    const tokensEstimados = estimarTokens(caracteres, obterFatorTokens());
    if (tokensEstimados + reserva > numCtx) throw new ErroContextoInsuficiente(tokensEstimados + reserva, numCtx);

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: opcoes.sinal,
        body: JSON.stringify({
          model: modelo,
          stream: true,
          think: false,
          format: formato,
          messages: historico,
          options: { temperature: 0.6, num_ctx: numCtx, num_predict: reserva },
        }),
      });
    } catch (erro) {
      if (ehCancelamento(erro)) throw erro;
      throw new ErroAplicacao(`O Ollama não está respondendo em ${urlBase}`, 503);
    }

    if (!resposta.ok) {
      throw new ErroAplicacao(`O Ollama respondeu com erro ${resposta.status}: ${await resposta.text()}`, 503);
    }

    const { conteudo, tokensPrompt, tokensResposta } = await lerRespostaEmPartes(resposta);
    registrarAmostraTokens(caracteres, tokensPrompt);
    const { percentualCpu, contextoCarregado } = await medirCarga(urlBase, modelo);
    usoCpu.set(modelo, percentualCpu);
    const numCtxReal = contextoCarregado && contextoCarregado < numCtx ? contextoCarregado : numCtx;

    try {
      const resultado = esquema.safeParse(JSON.parse(conteudo));
      if (resultado.success) {
        return {
          dados: resultado.data,
          medicao: {
            modelo,
            numCtx: numCtxReal,
            tokensEstimados,
            tokensPrompt,
            tokensResposta,
            possivelCorte: tokensPrompt >= numCtxReal - reserva,
            percentualCpu,
            duracaoSegundos: Math.round((performance.now() - inicio) / 100) / 10,
          },
        };
      }
      ultimoErro = resultado.error.issues.map((problema) => formatarProblema(problema)).join("; ");
    } catch {
      ultimoErro = "a resposta não era JSON válido";
    }

    historico.push(
      { role: "assistant", content: conteudo },
      {
        role: "user",
        content: `A resposta anterior foi recusada (${ultimoErro}). Responda novamente apenas com o JSON corrigido, seguindo o formato pedido.`,
      },
    );
  }

  throw new ErroAplicacao(
    `O modelo não gerou uma resposta válida após ${tentativas} tentativas (${ultimoErro})`,
    502,
  );
}
