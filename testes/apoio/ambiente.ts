import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { criarApp } from "../../src/servidor/app.js";
import { fecharBanco } from "../../src/banco/banco.js";
import { criarOuReconhecerWorkspace } from "../../src/workspace/workspace.js";
import type { OpcoesExecucao } from "../../src/nucleo/opcoesExecucao.js";

// Pasta temporária isolada por teste (fora do projeto).
export function criarPastaTemporaria(prefixo: string): string {
  return mkdtempSync(join(tmpdir(), `gangoy-${prefixo}-`));
}

export function removerPasta(caminho: string): void {
  rmSync(caminho, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export interface AmbienteTeste {
  app: FastifyInstance;
  raiz: string;
  dados: string;
  local: string;
  workspace: string;
  host: { host: string };
  encerrar(): Promise<void>;
}

// App com pasta de dados e workspace temporárias. Ollama padrão aponta para porta fechada.
export async function criarAmbienteComWorkspace(
  porta: number,
  opcoes: Partial<OpcoesExecucao> = {},
): Promise<AmbienteTeste> {
  const raiz = criarPastaTemporaria("amb");
  const dados = join(raiz, "dados");
  const local = join(raiz, "local");
  mkdirSync(local, { recursive: true });
  const app = await criarApp({ porta, pastaDados: dados, urlOllama: "http://127.0.0.1:9", ...opcoes });
  const { caminho } = criarOuReconhecerWorkspace(local);
  return {
    app,
    raiz,
    dados,
    local,
    workspace: caminho,
    host: { host: `localhost:${porta}` },
    async encerrar() {
      await app.close();
      fecharBanco();
      removerPasta(raiz);
    },
  };
}
