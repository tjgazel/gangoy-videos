import { closeSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// O Ollama não expõe pela API o "Context length" padrão (o slider do app). No Windows o app o guarda em
// db.sqlite e registra no server.log o que o servidor realmente subiu; a diferença entre os dois significa
// "mudou o slider e não reiniciou o Ollama". Leitura só para leitura, e só dessa coluna.

export interface ContextoPadraoOllama {
  /** Contexto padrão com que o servidor do Ollama subiu (vale para chamadas sem num_ctx). */
  emVigor: number | null;
  /** Contexto escolhido hoje no app do Ollama (só passa a valer depois de reiniciar). */
  configurado: number | null;
}

const BYTES_DO_INICIO_DO_LOG = 64 * 1024;

// GANGOY_PASTA_OLLAMA existe para os testes; no uso normal é a pasta do app do Ollama no Windows.
export function pastaDadosOllama(): string | null {
  if (process.env.GANGOY_PASTA_OLLAMA) return process.env.GANGOY_PASTA_OLLAMA;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, "Ollama");
  return null;
}

function lerEmVigor(pasta: string): number | null {
  let descritor: number | null = null;
  try {
    descritor = openSync(join(pasta, "server.log"), "r");
    const buffer = Buffer.alloc(BYTES_DO_INICIO_DO_LOG);
    const lidos = readSync(descritor, buffer, 0, buffer.length, 0);
    const achado = /OLLAMA_CONTEXT_LENGTH:(\d+)/.exec(buffer.toString("utf8", 0, lidos));
    return achado ? Number(achado[1]) : null;
  } catch {
    return null;
  } finally {
    if (descritor !== null) closeSync(descritor);
  }
}

function lerConfigurado(pasta: string): number | null {
  let banco: DatabaseSync | null = null;
  try {
    banco = new DatabaseSync(join(pasta, "db.sqlite"), { readOnly: true });
    const linha = banco.prepare("SELECT context_length FROM settings LIMIT 1").get() as { context_length?: number } | undefined;
    return typeof linha?.context_length === "number" && linha.context_length > 0 ? linha.context_length : null;
  } catch {
    return null;
  } finally {
    banco?.close();
  }
}

export function lerContextoPadraoOllama(pasta: string | null = pastaDadosOllama()): ContextoPadraoOllama {
  if (!pasta) return { emVigor: null, configurado: null };
  return { emVigor: lerEmVigor(pasta), configurado: lerConfigurado(pasta) };
}
