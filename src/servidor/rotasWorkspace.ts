import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { obterStatusSistema } from "../sistema/status.js";
import { apontarWorkspace, criarOuReconhecerWorkspace, estadoWorkspace } from "../workspace/workspace.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { apagarDadosAntigosConvertidos, listarDadosAntigosConvertidos } from "../workspace/conversao.js";
import { criarPasta, listarPastas, listarRaizes } from "../workspace/navegadorPastas.js";
import { criarTarefa, haTarefaEmExecucao, iniciarFila, prepararFilaAoIniciar } from "../tarefas/fila.js";
import { validarDestinoMovimento } from "../workspace/mover.js";

// Workspace recém-aberta: marca as interrompidas e volta a processar a fila dela.
// Trocar de workspace no meio de uma tarefa gravaria o resultado na workspace errada.
function exigirSemTrabalhoEmAndamento(): void {
  if (estadoWorkspace().movendo) throw new ErroAplicacao("A workspace está sendo movida. Aguarde a conclusão.", 409);
  if (haTarefaEmExecucao()) {
    throw new ErroAplicacao("Há uma tarefa em execução. Aguarde terminar ou cancele antes de trocar de workspace.", 409);
  }
}

function retomarFila(): void {
  prepararFilaAoIniciar();
  iniciarFila();
}

export function registrarRotasWorkspace(app: FastifyInstance): void {
  app.get("/api/sistema/status", async () => obterStatusSistema());

  // Navegador de pastas: sem caminho, só as raízes (unidades no Windows; / e pasta pessoal no Linux).
  app.get<{ Querystring: { caminho?: string } }>("/api/sistema/pastas", async (requisicao) => {
    const raizes = listarRaizes();
    const caminho = requisicao.query.caminho?.trim();
    if (!caminho) return { caminho: null, pai: null, pastas: [], raizes };
    return { ...listarPastas(caminho), raizes };
  });

  app.post("/api/sistema/pastas", async (requisicao, resposta) => {
    const corpo = z.object({ caminhoPai: z.string().min(1), nome: z.string() }).parse(requisicao.body);
    return resposta.code(201).send(criarPasta(corpo.caminhoPai, corpo.nome));
  });

  app.post("/api/workspace", async (requisicao) => {
    const { local } = z.object({ local: z.string().trim().min(1, "Escolha uma pasta") }).parse(requisicao.body);
    exigirSemTrabalhoEmAndamento();
    const resultado = criarOuReconhecerWorkspace(local);
    retomarFila();
    return resultado;
  });

  app.post("/api/workspace/apontar", async (requisicao) => {
    const { caminho } = z.object({ caminho: z.string().trim().min(1, "Escolha uma pasta") }).parse(requisicao.body);
    exigirSemTrabalhoEmAndamento();
    const aberta = apontarWorkspace(caminho);
    retomarFila();
    return { caminho: aberta };
  });

  app.post("/api/workspace/mover", async (requisicao, resposta) => {
    const { destino } = z.object({ destino: z.string().trim().min(1, "Escolha uma pasta") }).parse(requisicao.body);
    validarDestinoMovimento(destino);
    const tarefa = criarTarefa({ tipo: "mover_workspace", projetoId: null, capituloNumero: null, parametros: { destino } });
    return resposta.code(202).send({ tarefaId: tarefa.id });
  });

  app.get("/api/workspace/dados-antigos", async () => listarDadosAntigosConvertidos());

  app.delete("/api/workspace/dados-antigos", async (_requisicao, resposta) => {
    apagarDadosAntigosConvertidos();
    return resposta.code(204).send();
  });
}
