import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { respostaPadraoOllama } from "./respostasOllama.js";

// Servidor HTTP local que imita a API do Ollama, para testes sem GPU.

export interface ModeloFalso {
  nome: string;
  contextoMaximo: number;
  tamanho?: number;
  tamanhoVram?: number;
}

export interface CorpoChatFalso {
  model: string;
  messages: { role: string; content: string }[];
  format?: { properties?: Record<string, unknown> };
  options: { num_ctx?: number; num_predict?: number; temperature?: number };
  think?: boolean;
  stream?: boolean;
}

export interface RespostaChatFalsa {
  conteudo: unknown;
  promptEvalCount?: number;
  atrasoMs?: number;
}

export interface OpcoesOllamaFalso {
  modelos?: ModeloFalso[];
  responderChat?: (corpo: CorpoChatFalso) => RespostaChatFalsa;
  atrasoMs?: number;
  // Força o prompt_eval_count de todas as respostas (ex.: simular possível corte).
  promptEvalCount?: number;
}

export interface OllamaFalso {
  url: string;
  pedidos: CorpoChatFalso[];
  definir(opcoes: Partial<OpcoesOllamaFalso>): void;
  fechar(): Promise<void>;
}

export const MODELOS_PADRAO: ModeloFalso[] = [
  { nome: "gemma4:12b-it-qat", contextoMaximo: 262144 },
  { nome: "gemma4:e4b-it-qat", contextoMaximo: 131072 },
  { nome: "qwen3.6:latest", contextoMaximo: 262144 },
];

function lerCorpo(requisicao: IncomingMessage): Promise<string> {
  return new Promise((pronto) => {
    let texto = "";
    requisicao.on("data", (parte) => (texto += parte));
    requisicao.on("end", () => pronto(texto));
  });
}

function json(resposta: ServerResponse, status: number, dados: unknown): void {
  resposta.writeHead(status, { "Content-Type": "application/json" });
  resposta.end(JSON.stringify(dados));
}

export async function iniciarOllamaFalso(opcoesIniciais: OpcoesOllamaFalso = {}): Promise<OllamaFalso> {
  const opcoes: OpcoesOllamaFalso = { modelos: MODELOS_PADRAO, responderChat: respostaPadraoOllama, ...opcoesIniciais };
  const pedidos: CorpoChatFalso[] = [];
  let ultimoModelo: string | null = null;

  const servidor = createServer(async (requisicao, resposta) => {
    const modelos = opcoes.modelos ?? MODELOS_PADRAO;
    const caminho = requisicao.url ?? "";
    if (caminho === "/api/version") return json(resposta, 200, { version: "0.35.1-falso" });
    if (caminho === "/api/tags") {
      return json(resposta, 200, {
        models: modelos.map((m) => ({
          name: m.nome,
          model: m.nome,
          size: m.tamanho ?? 7_000_000_000,
          digest: `${m.nome}-${m.contextoMaximo}`,
          details: { parameter_size: "12B", quantization_level: "Q4_0" },
        })),
      });
    }
    if (caminho === "/api/ps") {
      const carregado = modelos.find((m) => m.nome === ultimoModelo);
      return json(resposta, 200, {
        models: carregado
          ? [{ name: carregado.nome, model: carregado.nome, size: carregado.tamanho ?? 7_000_000_000, size_vram: carregado.tamanhoVram ?? carregado.tamanho ?? 7_000_000_000 }]
          : [],
      });
    }
    const corpo = JSON.parse((await lerCorpo(requisicao)) || "{}");
    if (caminho === "/api/show") {
      const modelo = modelos.find((m) => m.nome === corpo.model);
      if (!modelo) return json(resposta, 404, { error: `model '${corpo.model}' not found` });
      return json(resposta, 200, {
        model_info: { "general.architecture": "gemma4", "gemma4.context_length": modelo.contextoMaximo },
        capabilities: ["completion"],
      });
    }
    if (caminho === "/api/chat") {
      pedidos.push(corpo as CorpoChatFalso);
      ultimoModelo = corpo.model;
      const dados = (opcoes.responderChat ?? respostaPadraoOllama)(corpo as CorpoChatFalso);
      const atraso = dados.atrasoMs ?? opcoes.atrasoMs ?? 0;
      if (atraso > 0) await new Promise((pronto) => setTimeout(pronto, atraso));
      if (resposta.destroyed) return;
      const caracteres = (corpo as CorpoChatFalso).messages.reduce((total, m) => total + m.content.length, 0);
      const promptEvalCount = dados.promptEvalCount ?? opcoes.promptEvalCount ?? Math.ceil(caracteres / 3.5);
      if (corpo.stream) {
        // Como o Ollama: uma linha JSON por pedaço e a última com done e as contagens.
        const texto = JSON.stringify(dados.conteudo);
        const terco = Math.ceil(texto.length / 3);
        resposta.writeHead(200, { "Content-Type": "application/x-ndjson" });
        for (let i = 0; i < texto.length; i += terco) {
          const pedaco = { model: corpo.model, message: { role: "assistant", content: texto.slice(i, i + terco) }, done: false };
          resposta.write(`${JSON.stringify(pedaco)}\n`);
          await new Promise((pronto) => setTimeout(pronto, 5));
        }
        const final = { model: corpo.model, message: { role: "assistant", content: "" }, done: true, prompt_eval_count: promptEvalCount, eval_count: 120 };
        resposta.end(`${JSON.stringify(final)}\n`);
        return;
      }
      return json(resposta, 200, {
        model: corpo.model,
        message: { role: "assistant", content: JSON.stringify(dados.conteudo) },
        prompt_eval_count: dados.promptEvalCount ?? opcoes.promptEvalCount ?? Math.ceil(caracteres / 3.5),
        eval_count: 120,
        done: true,
      });
    }
    json(resposta, 404, { error: "não encontrado" });
  });

  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${porta}`,
    pedidos,
    definir: (novas) => Object.assign(opcoes, novas),
    fechar: () =>
      new Promise((pronto) => {
        servidor.closeAllConnections();
        servidor.close(() => pronto());
      }),
  };
}
