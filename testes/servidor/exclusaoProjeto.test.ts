import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { aguardarFilaOciosa, cancelarTarefa, criarTarefa, registrarExecutor } from "../../src/tarefas/fila.js";
import { criarProjeto, type Projeto } from "../../src/projetos/projetos.js";
import { salvarDossie, esquemaDossie } from "../../src/dossie/dossie.js";

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));
const MENSAGEM = "Há tarefas deste projeto na fila ou em execução. Aguarde terminar ou cancele antes de excluir.";
let ambiente: AmbienteTeste;

beforeEach(async () => {
  ambiente = await criarAmbienteComWorkspace(3987);
});
afterEach(() => ambiente.encerrar());

function novoProjeto(nome: string): Projeto {
  const projeto = criarProjeto({ nome, tematica: "", idCanal: "", idPlaylist: "", frequencia: "diaria", duracaoPadraoMinutos: 8, modeloOllama: "" });
  salvarDossie(projeto.slug, esquemaDossie.parse({}));
  return projeto;
}

function excluir(id: number) {
  return ambiente.app.inject({ method: "DELETE", url: `/api/projetos/${id}`, headers: ambiente.host });
}

test("excluir projeto com tarefa em execução → 409 e nada é mexido", async () => {
  registrarExecutor("gerar_roteiro", async () => {
    await esperar(300);
    return null;
  });
  const projeto = novoProjeto("Em uso");
  criarTarefa({ tipo: "gerar_roteiro", projetoId: projeto.id, capituloNumero: 1 });
  await esperar(50);
  const r = await excluir(projeto.id);
  assert.equal(r.statusCode, 409);
  assert.deepEqual(r.json(), { erro: MENSAGEM });
  assert.ok(existsSync(join(ambiente.workspace, projeto.slug)));
  await aguardarFilaOciosa();
});

test("excluir projeto com tarefa na fila → 409; depois de cancelar, exclui", async () => {
  registrarExecutor("gerar_roteiro", async () => {
    await esperar(300);
    return null;
  });
  const outro = novoProjeto("Outro");
  const projeto = novoProjeto("Esperando");
  criarTarefa({ tipo: "gerar_roteiro", projetoId: outro.id, capituloNumero: 1 });
  const naFila = criarTarefa({ tipo: "gerar_roteiro", projetoId: projeto.id, capituloNumero: 1 });
  await esperar(50);
  const r = await excluir(projeto.id);
  assert.equal(r.statusCode, 409);
  assert.deepEqual(r.json(), { erro: MENSAGEM });
  cancelarTarefa(naFila.id);
  assert.equal((await excluir(projeto.id)).statusCode, 200);
  await aguardarFilaOciosa();
});

test("tarefa de outro projeto não impede a exclusão", async () => {
  registrarExecutor("gerar_roteiro", async () => {
    await esperar(300);
    return null;
  });
  const outro = novoProjeto("Ocupado");
  const projeto = novoProjeto("Livre");
  criarTarefa({ tipo: "gerar_roteiro", projetoId: outro.id, capituloNumero: 1 });
  await esperar(50);
  assert.equal((await excluir(projeto.id)).statusCode, 200);
  await aguardarFilaOciosa();
});
