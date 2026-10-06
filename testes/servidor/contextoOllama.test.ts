import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarAmbienteComWorkspace, criarPastaTemporaria, removerPasta } from "../apoio/ambiente.js";
import { gravarBancoOllamaApp, gravarLogOllamaApp } from "../apoio/ollamaApp.js";
import { lerContextoPadraoOllama } from "../../src/ollama/configuracaoOllama.js";

// O app do Ollama (Windows) guarda o slider "Context length" em db.sqlite e registra no server.log o que o
// servidor realmente subiu. Os testes montam uma pasta igual a essa, sem tocar na do usuário.

let pasta: string;

beforeEach(() => {
  pasta = criarPastaTemporaria("ollama");
});
afterEach(() => removerPasta(pasta));

const gravarBanco = (contexto: number) => gravarBancoOllamaApp(pasta, contexto);
const gravarLog = (contexto: number) => gravarLogOllamaApp(pasta, contexto);

test("lê o contexto configurado no app e o que o servidor subiu", () => {
  gravarBanco(65536);
  gravarLog(65536);
  assert.deepEqual(lerContextoPadraoOllama(pasta), { emVigor: 65536, configurado: 65536 });
});

test("slider alterado sem reiniciar: configurado e em vigor diferem", () => {
  gravarBanco(65536);
  gravarLog(262144);
  assert.deepEqual(lerContextoPadraoOllama(pasta), { emVigor: 262144, configurado: 65536 });
});

test("sem o log, só o configurado; sem o banco, só o em vigor", () => {
  gravarBanco(32768);
  assert.deepEqual(lerContextoPadraoOllama(pasta), { emVigor: null, configurado: 32768 });
  removerPasta(pasta);
  pasta = criarPastaTemporaria("ollama");
  gravarLog(131072);
  assert.deepEqual(lerContextoPadraoOllama(pasta), { emVigor: 131072, configurado: null });
});

test("pasta inexistente, vazia ou banco sem a tabela → nada lido, sem lançar erro", () => {
  assert.deepEqual(lerContextoPadraoOllama(join(pasta, "nao-existe")), { emVigor: null, configurado: null });
  assert.deepEqual(lerContextoPadraoOllama(null), { emVigor: null, configurado: null });
  mkdirSync(join(pasta, "vazia"));
  assert.deepEqual(lerContextoPadraoOllama(join(pasta, "vazia")), { emVigor: null, configurado: null });
  writeFileSync(join(pasta, "db.sqlite"), "isto não é um banco sqlite");
  assert.deepEqual(lerContextoPadraoOllama(pasta), { emVigor: null, configurado: null });
});

test("não altera o banco nem o log do Ollama", () => {
  gravarBanco(65536);
  gravarLog(65536);
  const antes = [readFileSync(join(pasta, "db.sqlite")), readFileSync(join(pasta, "server.log"))];
  lerContextoPadraoOllama(pasta);
  const depois = [readFileSync(join(pasta, "db.sqlite")), readFileSync(join(pasta, "server.log"))];
  assert.ok(antes[0]!.equals(depois[0]!));
  assert.ok(antes[1]!.equals(depois[1]!));
});

test("GET /api/ollama/contexto-padrao devolve o configurado e o em vigor", async () => {
  gravarBanco(65536);
  gravarLog(262144);
  process.env.GANGOY_PASTA_OLLAMA = pasta;
  const ambiente = await criarAmbienteComWorkspace(3994);
  try {
    const resposta = await ambiente.app.inject({ method: "GET", url: "/api/ollama/contexto-padrao", headers: ambiente.host });
    assert.equal(resposta.statusCode, 200);
    assert.deepEqual(resposta.json(), { emVigor: 262144, configurado: 65536 });
  } finally {
    delete process.env.GANGOY_PASTA_OLLAMA;
    await ambiente.encerrar();
  }
});
