import { obterConfiguracoesSistema } from "../configuracoes/sistema.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";
import { ultimoPercentualCpu } from "./ollama.js";

// Modelos já instalados no Ollama (instalar e remover fica com o usuário, direto no Ollama).

export interface ModeloOllama {
  nome: string;
  tamanhoBytes: number;
  parametros: string;
  quantizacao: string;
  contextoMaximo: number | null;
  capacidades: string[];
  percentualCpu: number | null;
}

interface DetalheModelo {
  contextoMaximo: number | null;
  capacidades: string[];
}

// /api/show é lento; guarda por nome + digest (um "ollama pull" novo muda o digest).
const cacheDetalhes = new Map<string, DetalheModelo>();

function foraDoAr(): ErroAplicacao {
  return new ErroAplicacao(`O Ollama não está respondendo em ${obterOpcoesExecucao().urlOllama}`, 503);
}

async function pedir<T>(caminho: string, corpo?: unknown): Promise<T> {
  const url = `${obterOpcoesExecucao().urlOllama}${caminho}`;
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: corpo === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw foraDoAr();
  }
  if (!resposta.ok) throw new ErroAplicacao(`O Ollama respondeu com erro ${resposta.status} em ${caminho}`, 503);
  return (await resposta.json()) as T;
}

async function detalhar(nome: string, digest: string): Promise<DetalheModelo> {
  const chaveCache = `${nome}@${digest}`;
  const guardado = cacheDetalhes.get(chaveCache);
  if (guardado) return guardado;
  const dados = await pedir<{ model_info?: Record<string, unknown>; capabilities?: string[] }>("/api/show", { model: nome });
  const chave = Object.keys(dados.model_info ?? {}).find((k) => k.endsWith(".context_length"));
  const detalhe = {
    contextoMaximo: chave ? Number(dados.model_info![chave]) : null,
    capacidades: dados.capabilities ?? [],
  };
  cacheDetalhes.set(chaveCache, detalhe);
  return detalhe;
}

export async function listarModelos(): Promise<ModeloOllama[]> {
  const { models = [] } = await pedir<{
    models?: {
      name: string;
      size: number;
      digest?: string;
      details?: { parameter_size?: string; quantization_level?: string };
    }[];
  }>("/api/tags");
  return Promise.all(
    models.map(async (m) => ({
      nome: m.name,
      tamanhoBytes: m.size,
      parametros: m.details?.parameter_size ?? "",
      quantizacao: m.details?.quantization_level ?? "",
      ...(await detalhar(m.name, m.digest ?? "")),
      percentualCpu: ultimoPercentualCpu(m.name),
    })),
  );
}

// O Ollama trata "qwen3.6" como "qwen3.6:latest".
export function normalizarNomeModelo(nome: string): string {
  const limpo = nome.trim();
  return limpo.includes(":") ? limpo : `${limpo}:latest`;
}

export async function garantirModeloInstalado(nome: string): Promise<string> {
  const alvo = normalizarNomeModelo(nome);
  const encontrado = (await listarModelos()).find((m) => normalizarNomeModelo(m.nome) === alvo);
  if (!encontrado) {
    throw new ErroAplicacao(`O modelo ${nome} não está instalado no Ollama. Escolha outro em Configurações.`, 422);
  }
  return encontrado.nome;
}

// Escolhido na geração > escolhido no projeto (só para o principal) > padrão do sistema.
export function resolverModelo(
  tipo: "principal" | "leve",
  opcoes: { modeloProjeto?: string; modeloEscolhido?: string } = {},
): string {
  if (opcoes.modeloEscolhido?.trim()) return opcoes.modeloEscolhido.trim();
  const sistema = obterConfiguracoesSistema();
  if (tipo === "leve") return sistema.modeloLeve;
  return opcoes.modeloProjeto?.trim() || sistema.modeloPrincipal;
}
