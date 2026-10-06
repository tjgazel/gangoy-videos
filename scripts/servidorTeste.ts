// Servidor para os testes de interface (Playwright): pastas temporárias e Ollama falso.
// As rotas /__teste/* existem só aqui, nunca no servidor real.
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { criarApp } from "../src/servidor/app.js";
import { fecharBanco } from "../src/banco/banco.js";
import { definirOpcoesExecucao, obterOpcoesExecucao } from "../src/nucleo/opcoesExecucao.js";
import {
  abrirWorkspaceConfigurada,
  ARQUIVO_BANCO,
  ARQUIVO_MARCADOR,
  criarOuReconhecerWorkspace,
  obterPastaWorkspace,
} from "../src/workspace/workspace.js";
import { aguardarFilaOciosa, iniciarFila, prepararFilaAoIniciar } from "../src/tarefas/fila.js";
import { iniciarOllamaFalso, MODELOS_PADRAO } from "../testes/apoio/ollamaFalso.js";
import { respostaPadraoOllama } from "../testes/apoio/respostasOllama.js";
import { criarPastaTemporaria, removerPasta } from "../testes/apoio/ambiente.js";
import { criarDadosAntigos } from "../testes/apoio/fixturesAntigas.js";

const PORTA = 3100;
const falso = await iniciarOllamaFalso();
let raiz = criarPastaTemporaria("e2e");

const app = await criarApp({ porta: PORTA, pastaDados: join(raiz, "dados"), urlOllama: falso.url });

app.post<{ Body: { comWorkspace?: boolean; comDadosAntigos?: boolean } }>("/__teste/reiniciar", async (requisicao) => {
  await aguardarFilaOciosa();
  fecharBanco();
  removerPasta(raiz);
  raiz = criarPastaTemporaria("e2e");
  const local = join(raiz, "local");
  mkdirSync(local, { recursive: true });
  definirOpcoesExecucao({ ...obterOpcoesExecucao(), pastaDados: join(raiz, "dados") });
  // Formato anterior à workspace: é convertido quando a workspace for criada.
  if (requisicao.body?.comDadosAntigos) criarDadosAntigos(join(raiz, "dados"));
  abrirWorkspaceConfigurada();
  falso.definir({ modelos: MODELOS_PADRAO, responderChat: respostaPadraoOllama, atrasoMs: 0, promptEvalCount: undefined });
  let workspace: string | null = null;
  if (requisicao.body?.comWorkspace) {
    workspace = criarOuReconhecerWorkspace(local).caminho;
    prepararFilaAoIniciar();
    iniciarFila();
  }
  return { raiz, local, workspace };
});

app.post<{ Body: { atrasoMs?: number; promptEvalCount?: number; gpuParcial?: boolean } }>("/__teste/ollama", async (requisicao) => {
  falso.definir({ atrasoMs: requisicao.body?.atrasoMs ?? 0, promptEvalCount: requisicao.body?.promptEvalCount });
  // 70% na GPU e 30% na CPU, para testar o aviso de lentidão.
  if (requisicao.body?.gpuParcial) falso.definir({ modelos: MODELOS_PADRAO.map((m) => ({ ...m, tamanho: 10, tamanhoVram: 7 })) });
  return { ok: true };
});

// Simula o disco que sumiu (sem marcador) ou o banco apagado (marcador sem gangoy.db).
app.post<{ Body: { remover: "marcador" | "banco" } }>("/__teste/estragar-workspace", async (requisicao) => {
  const pasta = obterPastaWorkspace();
  await aguardarFilaOciosa();
  fecharBanco();
  const nomes = requisicao.body.remover === "marcador" ? [ARQUIVO_MARCADOR] : [ARQUIVO_BANCO, `${ARQUIVO_BANCO}-wal`, `${ARQUIVO_BANCO}-shm`];
  for (const nome of nomes) rmSync(join(pasta, nome), { force: true });
  return { ok: true };
});

await app.listen({ port: PORTA, host: "127.0.0.1" });
