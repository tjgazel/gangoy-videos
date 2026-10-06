import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { iniciarOllamaFalso, type OllamaFalso } from "../apoio/ollamaFalso.js";
import { aguardarFilaOciosa, buscarTarefa } from "../../src/tarefas/fila.js";
import { listarPendencias } from "../../src/revisao/revisao.js";

let falso: OllamaFalso;
let ambiente: AmbienteTeste;

before(async () => {
  falso = await iniciarOllamaFalso();
  ambiente = await criarAmbienteComWorkspace(3989, { urlOllama: falso.url });
});
after(async () => {
  await ambiente.encerrar();
  await falso.fechar();
});

async function pedir(metodo: "GET" | "POST", url: string, payload?: unknown) {
  return ambiente.app.inject({ method: metodo, url, headers: ambiente.host, payload: payload as object });
}
async function tarefa(url: string, payload?: unknown) {
  const resposta = await pedir("POST", url, payload);
  assert.equal(resposta.statusCode, 202);
  await aguardarFilaOciosa();
  return buscarTarefa(resposta.json().tarefaId)!;
}

test("roteiro gerado e proposta pronta aparecem; somem depois de aprovar", async () => {
  const id = (await pedir("POST", "/api/projetos", { nome: "Revisão" })).json().id as number;
  const plano = await tarefa(`/api/projetos/${id}/planejamento`, { enredo: "Léo encontra um ovo de dragão e salva a vila." });
  await pedir("POST", `/api/projetos/${id}/planejamento/confirmar`, plano.resultado);
  assert.deepEqual(listarPendencias(id), []);

  await tarefa(`/api/projetos/${id}/capitulos/2/roteiro`);
  await tarefa(`/api/projetos/${id}/capitulos/1/roteiro`);
  const versao = (await pedir("GET", `/api/projetos/${id}/capitulos/1/roteiro`)).json();
  let itens = listarPendencias(id);
  assert.deepEqual(itens.map((i) => `${i.tipo}:${i.capituloNumero}`), ["roteiro_para_aprovar:2", "roteiro_para_aprovar:1"]);
  assert.equal(itens[1]!.desde, versao.criadoEm);
  assert.equal(itens[1]!.titulo, "O Ovo do Lago");
  assert.equal(itens[1]!.tarefaId, null);

  const proposta = await tarefa(`/api/projetos/${id}/capitulos/1/proposta-dossie`);
  itens = listarPendencias(id);
  const pronta = itens.find((i) => i.tipo === "proposta_dossie_pronta")!;
  assert.equal(pronta.capituloNumero, 1);
  assert.equal(pronta.tarefaId, proposta.id);

  await pedir("POST", `/api/projetos/${id}/capitulos/1/aprovar`, proposta.resultado);
  itens = listarPendencias(id);
  assert.deepEqual(itens.map((i) => `${i.tipo}:${i.capituloNumero}`), ["roteiro_para_aprovar:2"]);

  const rota = await pedir("GET", `/api/revisao?projetoId=${id}`);
  assert.deepEqual(rota.json().itens.map((i: { capituloNumero: number }) => i.capituloNumero), [2]);
  assert.equal((await pedir("GET", "/api/revisao")).json().itens.length, 1);
});
