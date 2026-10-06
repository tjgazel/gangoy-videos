import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { iniciarOllamaFalso, MODELOS_PADRAO, type OllamaFalso } from "../apoio/ollamaFalso.js";
import { respostaPadraoOllama, roteiroFalso } from "../apoio/respostasOllama.js";
import { aguardarFilaOciosa, buscarTarefa, listarTarefas } from "../../src/tarefas/fila.js";
import { assinarEventos } from "../../src/tarefas/eventos.js";
import { salvarConfiguracao } from "../../src/configuracoes/sistema.js";
import { salvarNovaVersaoRoteiro } from "../../src/capitulos/capitulos.js";
import type { Tarefa } from "../../src/tarefas/tipos.js";

let falso: OllamaFalso;
let ambiente: AmbienteTeste;
let contador = 0;

before(async () => {
  falso = await iniciarOllamaFalso();
  ambiente = await criarAmbienteComWorkspace(3990, { urlOllama: falso.url });
});
after(async () => {
  await ambiente.encerrar();
  await falso.fechar();
});
beforeEach(() => {
  falso.pedidos.length = 0;
  falso.definir({ modelos: MODELOS_PADRAO, responderChat: respostaPadraoOllama, atrasoMs: 0 });
  salvarConfiguracao("contexto_trabalho", "32768");
  salvarConfiguracao("amostras_fator_tokens", "[]");
});

async function pedir(metodo: "GET" | "POST", url: string, payload?: unknown) {
  return ambiente.app.inject({ method: metodo, url, headers: ambiente.host, payload: payload as object });
}

async function concluir(resposta: { statusCode: number; json(): { tarefaId: number } }): Promise<Tarefa> {
  assert.equal(resposta.statusCode, 202);
  await aguardarFilaOciosa();
  return buscarTarefa(resposta.json().tarefaId)!;
}

// Projeto com planejamento confirmado (capítulos 1 a 3).
async function projetoPlanejado(): Promise<number> {
  const criado = await pedir("POST", "/api/projetos", { nome: `História ${++contador}` });
  const id = criado.json().id as number;
  const proposta = await concluir(await pedir("POST", `/api/projetos/${id}/planejamento`, { enredo: "Léo encontra um ovo de dragão e salva a vila da seca." }));
  assert.equal(proposta.status, "concluida");
  const confirmado = await pedir("POST", `/api/projetos/${id}/planejamento/confirmar`, proposta.resultado);
  assert.equal(confirmado.statusCode, 200);
  return id;
}

test("fluxo pela fila: planejar → confirmar → gerar → refazer → continuidade → propor → aprovar", async () => {
  const id = await projetoPlanejado();
  const gerada = await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/roteiro`));
  assert.equal(gerada.status, "concluida");
  assert.deepEqual(gerada.resultado, { versao: 1 });
  const refeita = await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/refazer`, { instrucao: "Brisa precisa ser verde" }));
  assert.deepEqual(refeita.resultado, { versao: 2 });
  const continuidade = await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/continuidade`));
  assert.deepEqual(continuidade.resultado, { aprovado: true, problemas: [] });
  const proposta = await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/proposta-dossie`));
  assert.equal(proposta.status, "concluida");
  const aprovado = await pedir("POST", `/api/projetos/${id}/capitulos/1/aprovar`, proposta.resultado);
  assert.equal(aprovado.statusCode, 200);
  const capitulos = (await pedir("GET", `/api/projetos/${id}/capitulos`)).json();
  assert.equal(capitulos[0].status, "aprovado");
});

test("validação rápida volta na hora, sem criar tarefa", async () => {
  const criado = await pedir("POST", "/api/projetos", { nome: `Validação ${++contador}` });
  const id = criado.json().id as number;
  const curto = await pedir("POST", `/api/projetos/${id}/planejamento`, { enredo: "curto" });
  assert.equal(curto.statusCode, 400);
  assert.deepEqual(curto.json(), { erro: "Descreva o enredo com pelo menos 20 caracteres" });
  assert.equal(listarTarefas({ projetoId: id }).length, 0);

  const planejado = await projetoPlanejado();
  const semInstrucao = await pedir("POST", `/api/projetos/${planejado}/capitulos/1/refazer`, { instrucao: " " });
  assert.equal(semInstrucao.statusCode, 400);
  assert.deepEqual(semInstrucao.json(), { erro: "Escreva o que deve ser corrigido" });
});

test("versão guarda modelo, tempo e contexto", async () => {
  const id = await projetoPlanejado();
  await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/roteiro`));
  const versoes = (await pedir("GET", `/api/projetos/${id}/capitulos/1/versoes`)).json();
  assert.equal(versoes[0].modelo, "gemma4:12b-it-qat");
  assert.equal(typeof versoes[0].duracaoGeracaoSegundos, "number");
  assert.equal(versoes[0].contexto.numCtx, 32768);
  assert.equal(versoes[0].contexto.possivelCorte, false);
});

test("modelo escolhido na geração é usado", async () => {
  const id = await projetoPlanejado();
  falso.pedidos.length = 0;
  await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/roteiro`, { modelo: "qwen3.6" }));
  assert.equal(falso.pedidos.at(-1)!.model, "qwen3.6:latest");
});

test("sem espaço para o texto integral do capítulo anterior, usa o resumo", async () => {
  const id = await projetoPlanejado();
  const slug = (await pedir("GET", `/api/projetos/${id}`)).json().slug as string;
  const enorme = { titulo: "Longo", cenas: Array.from({ length: 8 }, () => ({ narracao: "palavra ".repeat(600), personagensPresentes: ["Léo"], descricaoVisual: "Cena longa do lago" })) };
  salvarNovaVersaoRoteiro(slug, 1, { instrucao: "", roteiro: enorme, palavras: 4800, minutosEstimados: 32 });
  salvarConfiguracao("contexto_trabalho", "12288");
  falso.pedidos.length = 0;
  const tarefa = await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/2/roteiro`));
  assert.equal(tarefa.status, "concluida", tarefa.erro ?? "");
  const conteudo = falso.pedidos[0]!.messages.map((m) => m.content).join("\n");
  assert.match(conteudo, /Resumo do capítulo 1 \(o texto integral não coube no contexto\):/);
});

test("nem com o resumo cabe → tarefa falhou com a mensagem de contexto", async () => {
  const id = await projetoPlanejado();
  salvarConfiguracao("contexto_trabalho", "4096");
  const tarefa = await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/roteiro`));
  assert.equal(tarefa.status, "falhou");
  assert.match(tarefa.erro!, /^O pedido precisa de ~/);
});

test("progresso: 'Gerando roteiro' e, na ampliação, 'Ampliando o texto'", async () => {
  const id = await projetoPlanejado();
  let chamadas = 0;
  falso.definir({
    responderChat: (corpo) => {
      if (!Object.keys(corpo.format?.properties ?? {}).includes("cenas")) return respostaPadraoOllama(corpo);
      chamadas++;
      const roteiro = roteiroFalso();
      return { conteudo: chamadas === 1 ? { ...roteiro, cenas: roteiro.cenas.slice(0, 3).map((c) => ({ ...c, narracao: "Léo andou pela vila com Brisa." })) } : roteiro };
    },
  });
  const mensagens: string[] = [];
  const cancelar = assinarEventos((evento) => {
    if (evento.tipo === "tarefa" && evento.dados.mensagem) mensagens.push(evento.dados.mensagem);
  });
  await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/roteiro`));
  cancelar();
  assert.ok(mensagens.includes("Gerando roteiro"));
  assert.ok(mensagens.includes("Ampliando o texto"));
  assert.equal(chamadas, 2);
});

test("workspace some durante a geração → falhou com 'Workspace não encontrada em'", async () => {
  const id = await projetoPlanejado();
  falso.definir({ atrasoMs: 300 });
  const resposta = await pedir("POST", `/api/projetos/${id}/capitulos/1/roteiro`);
  assert.equal(resposta.statusCode, 202);
  await new Promise((pronto) => setTimeout(pronto, 100));
  const marcador = join(ambiente.workspace, ".gangoy-workspace.json");
  const conteudo = readFileSync(marcador, "utf-8");
  unlinkSync(marcador);
  await aguardarFilaOciosa();
  writeFileSync(marcador, conteudo);
  const tarefa = buscarTarefa(resposta.json().tarefaId)!;
  assert.equal(tarefa.status, "falhou");
  assert.match(tarefa.erro!, /^Workspace não encontrada em /);
});

test("GET de uma versão específica do roteiro", async () => {
  const id = await projetoPlanejado();
  await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/roteiro`));
  await concluir(await pedir("POST", `/api/projetos/${id}/capitulos/1/refazer`, { instrucao: "Mais curto" }));
  const v1 = await pedir("GET", `/api/projetos/${id}/capitulos/1/versoes/1`);
  assert.equal(v1.statusCode, 200);
  assert.equal(v1.json().versao, 1);
  assert.equal((await pedir("GET", `/api/projetos/${id}/capitulos/1/versoes/2`)).json().instrucao, "Mais curto");
  const inexistente = await pedir("GET", `/api/projetos/${id}/capitulos/1/versoes/9`);
  assert.equal(inexistente.statusCode, 404);
  assert.deepEqual(inexistente.json(), { erro: "Versão 9 não encontrada" });
});
