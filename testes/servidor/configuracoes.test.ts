import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { obterConfiguracoesSistema } from "../../src/configuracoes/sistema.js";
import { lerCredenciaisCompletasYoutube } from "../../src/configuracoes/youtube.js";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";

let ambiente: AmbienteTeste;
let app: AmbienteTeste["app"];
let host: AmbienteTeste["host"];

before(async () => {
  ambiente = await criarAmbienteComWorkspace(3998);
  ({ app, host } = ambiente);
});
after(() => ambiente.encerrar());

test("padrões do sistema", () => {
  assert.deepEqual(obterConfiguracoesSistema(), {
    modeloPrincipal: "gemma4:12b-it-qat",
    modeloLeve: "gemma4:e4b-it-qat",
    contextoTrabalho: 32768,
  });
});

test("PUT credenciais sem secret na primeira vez → 400", async () => {
  const r = await app.inject({ method: "PUT", url: "/api/configuracoes/youtube", headers: host, payload: { clientId: "a" } });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.json(), { erro: "Informe o Client Secret do Google Cloud" });
});

test("secret nunca volta na API", async () => {
  const salvar = await app.inject({
    method: "PUT",
    url: "/api/configuracoes/youtube",
    headers: host,
    payload: { clientId: "a.apps.googleusercontent.com", clientSecret: "segredo-xyz" },
  });
  assert.equal(salvar.statusCode, 200);
  assert.doesNotMatch(salvar.body, /segredo-xyz/);
  const ler = await app.inject({ url: "/api/configuracoes/youtube", headers: host });
  assert.doesNotMatch(ler.body, /segredo-xyz/);
  assert.equal(ler.json().clientSecretSalvo, true);
});

test("secret vazio mantém o atual", async () => {
  const r = await app.inject({ method: "PUT", url: "/api/configuracoes/youtube", headers: host, payload: { clientId: "b", clientSecret: "" } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(lerCredenciaisCompletasYoutube(), { clientId: "b", clientSecret: "segredo-xyz" });
});
