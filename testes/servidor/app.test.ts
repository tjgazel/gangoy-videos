import { test, after } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { criarApp } from "../../src/servidor/app.js";
import { ErroAplicacao } from "../../src/nucleo/erros.js";
import { fecharBanco } from "../../src/banco/banco.js";
import { criarPastaTemporaria, removerPasta } from "../apoio/ambiente.js";

const tmp = criarPastaTemporaria("app");
after(() => {
  fecharBanco();
  removerPasta(tmp);
});

const PORTA = 3999;

test("Host diferente de localhost/127.0.0.1 recebe 403", async () => {
  const app = await criarApp({ porta: PORTA, pastaDados: tmp });
  const r = await app.inject({ url: "/api/configuracoes/app", headers: { host: `malicioso.com:${PORTA}` } });
  assert.equal(r.statusCode, 403);
  await app.close();
});

test("Host localhost:<porta> e 127.0.0.1:<porta> são aceitos; a porta do Vite, não", async () => {
  const app = await criarApp({ porta: PORTA, pastaDados: tmp });
  for (const host of [`localhost:${PORTA}`, `127.0.0.1:${PORTA}`]) {
    const r = await app.inject({ url: "/api/configuracoes/app", headers: { host } });
    assert.equal(r.statusCode, 200, host);
  }
  const vite = await app.inject({ url: "/api/configuracoes/app", headers: { host: "localhost:5173" } });
  assert.equal(vite.statusCode, 403);
  await app.close();
});

test("em desenvolvimento (npm run dev), Host e Origin da porta do Vite são aceitos", async () => {
  const app = await criarApp({ porta: PORTA, pastaDados: tmp, desenvolvimento: true });
  for (const host of ["localhost:5173", "127.0.0.1:5173"]) {
    const r = await app.inject({ url: "/api/configuracoes/app", headers: { host, origin: "http://localhost:5173" } });
    assert.equal(r.statusCode, 200, host);
  }
  await app.close();
});

test("ErroAplicacao vira { erro } com o status", async () => {
  const app = await criarApp({ porta: PORTA, pastaDados: tmp });
  app.get("/api/sistema/__erro", async () => {
    throw new ErroAplicacao("Proibido aqui", 418);
  });
  const r = await app.inject({ url: "/api/sistema/__erro", headers: { host: `localhost:${PORTA}` } });
  assert.equal(r.statusCode, 418);
  assert.deepEqual(r.json(), { erro: "Proibido aqui" });
  await app.close();
});

test("ZodError vira 400 com a primeira mensagem", async () => {
  const app = await criarApp({ porta: PORTA, pastaDados: tmp });
  app.get("/api/sistema/__zod", async () => z.string().min(3, "Curto").parse("a"));
  const r = await app.inject({ url: "/api/sistema/__zod", headers: { host: `localhost:${PORTA}` } });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.json(), { erro: "Curto" });
  await app.close();
});

test("requisição com Origin de outro site recebe 403; mesma origem passa", async () => {
  const app = await criarApp({ porta: PORTA, pastaDados: tmp });
  const host = `localhost:${PORTA}`;
  const estranho = await app.inject({ method: "POST", url: "/api/youtube/oauth/iniciar", headers: { host, origin: "https://malicioso.com" } });
  assert.equal(estranho.statusCode, 403);
  const mesma = await app.inject({ url: "/api/configuracoes/app", headers: { host, origin: `http://localhost:${PORTA}` } });
  assert.equal(mesma.statusCode, 200);
  const vite = await app.inject({ url: "/api/configuracoes/app", headers: { host, origin: "http://localhost:5173" } });
  assert.equal(vite.statusCode, 403);
  await app.close();
});
