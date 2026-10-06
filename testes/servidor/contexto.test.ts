import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { iniciarOllamaFalso, MODELOS_PADRAO, type OllamaFalso } from "../apoio/ollamaFalso.js";
import { respostaPadraoOllama } from "../apoio/respostasOllama.js";
import { gerarJsonIa, type Mensagem } from "../../src/ollama/ollama.js";
import { ErroContextoInsuficiente, obterFatorTokens, registrarAmostraTokens } from "../../src/ollama/contexto.js";
import { salvarConfiguracao } from "../../src/configuracoes/sistema.js";

let falso: OllamaFalso;
let ambiente: AmbienteTeste;
const esquema = z.object({ ok: z.boolean() });
const mensagens: Mensagem[] = [{ role: "user", content: "Responda ok." }];
const MODELO = "gemma4:12b-it-qat";

before(async () => {
  falso = await iniciarOllamaFalso();
  ambiente = await criarAmbienteComWorkspace(3992, { urlOllama: falso.url });
});
after(async () => {
  await ambiente.encerrar();
  await falso.fechar();
});
beforeEach(() => {
  falso.pedidos.length = 0;
  falso.definir({ modelos: MODELOS_PADRAO, responderChat: () => ({ conteudo: { ok: true } }) });
  salvarConfiguracao("contexto_trabalho", "32768");
  salvarConfiguracao("amostras_fator_tokens", "[]");
});

test("toda chamada envia num_ctx e num_predict", async () => {
  const { dados, medicao } = await gerarJsonIa(MODELO, mensagens, esquema, { tipo: "roteiro" });
  assert.deepEqual(dados, { ok: true });
  assert.equal(falso.pedidos[0]!.options.num_ctx, 32768);
  assert.equal(falso.pedidos[0]!.options.num_predict, 6000);
  assert.equal(medicao.numCtx, 32768);
  assert.equal(medicao.modelo, MODELO);
  assert.equal(medicao.possivelCorte, false);
});

test("pedido que não cabe → ErroContextoInsuficiente antes de chamar", async () => {
  salvarConfiguracao("contexto_trabalho", "4096");
  const enorme: Mensagem[] = [{ role: "user", content: "a".repeat(40000) }];
  await assert.rejects(gerarJsonIa(MODELO, enorme, esquema, { tipo: "roteiro" }), (erro) => {
    assert.ok(erro instanceof ErroContextoInsuficiente);
    assert.equal(erro.status, 422);
    assert.match(erro.message, /^O pedido precisa de ~[\d.]+ tokens e o contexto de trabalho é 4\.096\. Aumente o contexto em Configurações ou escolha um modelo com contexto maior\.$/);
    return true;
  });
  assert.equal(falso.pedidos.length, 0);
});

test("prompt_eval_count perto do limite marca possivelCorte", async () => {
  falso.definir({ responderChat: () => ({ conteudo: { ok: true }, promptEvalCount: 32768 - 6000 }) });
  const { medicao } = await gerarJsonIa(MODELO, mensagens, esquema, { tipo: "roteiro" });
  assert.equal(medicao.possivelCorte, true);
  assert.equal(medicao.tokensPrompt, 32768 - 6000);
});

test("calibra o fator com a média das amostras", () => {
  for (let i = 0; i < 20; i++) registrarAmostraTokens(350, 100);
  assert.equal(obterFatorTokens(), 3.5);
});

test("mede a fração em CPU por /api/ps", async () => {
  falso.definir({ modelos: [{ nome: MODELO, contextoMaximo: 262144, tamanho: 10, tamanhoVram: 7 }] });
  const { medicao } = await gerarJsonIa(MODELO, mensagens, esquema, { tipo: "continuidade" });
  assert.equal(medicao.percentualCpu, 30);
  assert.equal(falso.pedidos[0]!.options.num_predict, 2000);
});

test("cancelamento pelo sinal aborta o fetch", async () => {
  falso.definir({ responderChat: () => ({ conteudo: { ok: true }, atrasoMs: 500 }) });
  const controle = new AbortController();
  setTimeout(() => controle.abort(), 50);
  await assert.rejects(gerarJsonIa(MODELO, mensagens, esquema, { tipo: "roteiro", sinal: controle.signal }), { name: "AbortError" });
});

test("Ollama fora do ar → 503 com o endereço", async () => {
  const { obterOpcoesExecucao, definirOpcoesExecucao } = await import("../../src/nucleo/opcoesExecucao.js");
  const original = obterOpcoesExecucao();
  definirOpcoesExecucao({ ...original, urlOllama: "http://127.0.0.1:9" });
  await assert.rejects(gerarJsonIa(MODELO, mensagens, esquema, { tipo: "roteiro" }), {
    message: "O Ollama não está respondendo em http://127.0.0.1:9",
  });
  definirOpcoesExecucao(original);
});

test("respostas padrão do falso por formato", () => {
  assert.equal(respostaPadraoOllama({ model: "x", messages: [], options: {}, format: { properties: { problemas: {} } } }).conteudo instanceof Object, true);
});

test("usa streaming e junta os pedaços da resposta", async () => {
  falso.definir({ responderChat: () => ({ conteudo: { ok: true }, promptEvalCount: 1234 }) });
  const { dados, medicao } = await gerarJsonIa(MODELO, mensagens, esquema, { tipo: "roteiro" });
  assert.equal(falso.pedidos[0]!.stream, true);
  assert.deepEqual(dados, { ok: true });
  assert.equal(medicao.tokensPrompt, 1234);
});
