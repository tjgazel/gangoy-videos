import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { iniciarOllamaFalso, MODELOS_PADRAO, type OllamaFalso } from "../apoio/ollamaFalso.js";
import { garantirModeloInstalado, listarModelos, resolverModelo } from "../../src/ollama/modelos.js";
import { salvarConfiguracao } from "../../src/configuracoes/sistema.js";
import { criarProjeto } from "../../src/projetos/projetos.js";
import { ErroAplicacao } from "../../src/nucleo/erros.js";
import { definirOpcoesExecucao, obterOpcoesExecucao } from "../../src/nucleo/opcoesExecucao.js";

let falso: OllamaFalso;
let ambiente: AmbienteTeste;

before(async () => {
  falso = await iniciarOllamaFalso();
  ambiente = await criarAmbienteComWorkspace(3991, { urlOllama: falso.url });
});
after(async () => {
  await ambiente.encerrar();
  await falso.fechar();
});
beforeEach(() => {
  falso.definir({ modelos: MODELOS_PADRAO });
  salvarConfiguracao("modelo_principal", "gemma4:12b-it-qat");
  salvarConfiguracao("modelo_leve", "gemma4:e4b-it-qat");
  salvarConfiguracao("contexto_trabalho", "32768");
});

test("lista modelos com contexto máximo de model_info", async () => {
  const modelos = await listarModelos();
  const gemma = modelos.find((m) => m.nome === "gemma4:12b-it-qat")!;
  assert.equal(gemma.contextoMaximo, 262144);
  assert.equal(gemma.quantizacao, "Q4_0");
  assert.equal(gemma.parametros, "12B");
  assert.deepEqual(gemma.capacidades, ["completion"]);
  const rota = await ambiente.app.inject({ url: "/api/ollama/modelos", headers: ambiente.host });
  assert.equal(rota.json().length, 3);
});

test("nome sem tag casa com :latest", async () => {
  assert.equal(await garantirModeloInstalado("qwen3.6"), "qwen3.6:latest");
});

test("modelo ausente → 422 com a mensagem", async () => {
  await assert.rejects(garantirModeloInstalado("llama9"), (erro) => {
    assert.ok(erro instanceof ErroAplicacao);
    assert.equal(erro.status, 422);
    assert.equal(erro.message, "O modelo llama9 não está instalado no Ollama. Escolha outro em Configurações.");
    return true;
  });
});

test("precedência: escolhido > projeto > sistema; leve ignora o projeto", () => {
  assert.equal(resolverModelo("principal", { modeloProjeto: "qwen3.6", modeloEscolhido: "gemma4:e4b-it-qat" }), "gemma4:e4b-it-qat");
  assert.equal(resolverModelo("principal", { modeloProjeto: "qwen3.6" }), "qwen3.6");
  assert.equal(resolverModelo("principal", { modeloProjeto: "" }), "gemma4:12b-it-qat");
  assert.equal(resolverModelo("leve", { modeloProjeto: "qwen3.6" }), "gemma4:e4b-it-qat");
});

test("PUT contexto acima do máximo do modelo → 400", async () => {
  falso.definir({ modelos: [{ nome: "gemma4:12b-it-qat", contextoMaximo: 8192 }, ...MODELOS_PADRAO.slice(1)] });
  const r = await ambiente.app.inject({ method: "PUT", url: "/api/configuracoes", headers: ambiente.host, payload: { contextoTrabalho: 16384 } });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.json(), { erro: "O modelo gemma4:12b-it-qat aceita no máximo 8.192 tokens de contexto" });
});

test("PUT contexto abaixo de 4096 → 400", async () => {
  const r = await ambiente.app.inject({ method: "PUT", url: "/api/configuracoes", headers: ambiente.host, payload: { contextoTrabalho: 2048 } });
  assert.equal(r.statusCode, 400);
});

test("PUT válido salva e GET devolve", async () => {
  const r = await ambiente.app.inject({
    method: "PUT",
    url: "/api/configuracoes",
    headers: ambiente.host,
    payload: { modeloPrincipal: "qwen3.6", contextoTrabalho: 16384 },
  });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.json(), { modeloPrincipal: "qwen3.6:latest", modeloLeve: "gemma4:e4b-it-qat", contextoTrabalho: 16384 });
  const ler = await ambiente.app.inject({ url: "/api/configuracoes", headers: ambiente.host });
  assert.deepEqual(ler.json(), r.json());
});

test("PUT com Ollama fora do ar → 503", async () => {
  const original = obterOpcoesExecucao();
  definirOpcoesExecucao({ ...original, urlOllama: "http://127.0.0.1:9" });
  const r = await ambiente.app.inject({ method: "PUT", url: "/api/configuracoes", headers: ambiente.host, payload: { contextoTrabalho: 16384 } });
  definirOpcoesExecucao(original);
  assert.equal(r.statusCode, 503);
  assert.deepEqual(r.json(), { erro: "O Ollama não está respondendo em http://127.0.0.1:9" });
});

test("projeto criado sem modelo fica vazio e segue o padrão", () => {
  const projeto = criarProjeto({ nome: "Sem Modelo", tematica: "", idCanal: "", idPlaylist: "", frequencia: "diaria", duracaoPadraoMinutos: 8, modeloOllama: "" });
  assert.equal(projeto.modeloOllama, "");
  assert.equal(resolverModelo("principal", { modeloProjeto: projeto.modeloOllama }), "gemma4:12b-it-qat");
});
