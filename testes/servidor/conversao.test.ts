import { test, after } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { criarApp } from "../../src/servidor/app.js";
import { fecharBanco } from "../../src/banco/banco.js";
import { criarOuReconhecerWorkspace, definirConversaoAoCriar } from "../../src/workspace/workspace.js";
import { converterDadosAntigos } from "../../src/workspace/conversao.js";
import { copiarConferindo } from "../../src/workspace/copiaConferida.js";
import { ErroAplicacao } from "../../src/nucleo/erros.js";
import { listarProjetos } from "../../src/projetos/projetos.js";
import { listarCapitulos } from "../../src/capitulos/capitulos.js";
import { criarDadosAntigos } from "../apoio/fixturesAntigas.js";
import { criarPastaTemporaria, removerPasta } from "../apoio/ambiente.js";

const PORTA = 3996;
const host = { host: `localhost:${PORTA}` };
const pastas: string[] = [];
const apps: FastifyInstance[] = [];
after(async () => {
  for (const app of apps) await app.close();
  fecharBanco();
  for (const pasta of pastas) removerPasta(pasta);
});

async function ambienteComDadosAntigos() {
  const raiz = criarPastaTemporaria("conv");
  pastas.push(raiz);
  const dados = join(raiz, "dados");
  const local = join(raiz, "local");
  mkdirSync(local);
  criarDadosAntigos(dados);
  const app = await criarApp({ porta: PORTA, pastaDados: dados, urlOllama: "http://127.0.0.1:9" });
  apps.push(app);
  return { raiz, dados, local, app };
}

test("converte para a estrutura nova", async () => {
  const { dados, local } = await ambienteComDadosAntigos();
  const ws = criarOuReconhecerWorkspace(local).caminho;
  assert.ok(existsSync(join(ws, "leo-e-o-dragao", "capitulos", "capitulo-001", "roteiro", "roteiro_v2.json")));
  assert.ok(existsSync(join(ws, "leo-e-o-dragao", "capitulos", "capitulo-002", "roteiro", "roteiro_v1.json")));
  assert.ok(existsSync(join(ws, "leo-e-o-dragao", "dossie.json")));
  assert.equal(existsSync(join(ws, "leo-e-o-dragao", "capitulos", "001")), false);
  assert.ok(existsSync(join(dados, "app.db.migrado")) && existsSync(join(dados, "projetos.migrado")));
  assert.equal(existsSync(join(dados, "app.db")), false);
  const projetos = listarProjetos();
  assert.equal(projetos.length, 1);
  assert.equal(projetos[0]!.modeloOllama, "");
  assert.equal(listarCapitulos(projetos[0]!.id).length, 2);
});

test("falha na conferência desfaz a workspace nova e mantém dados/ intacto", async () => {
  const { dados, local, app } = await ambienteComDadosAntigos();
  const falhar = (): never => {
    throw new ErroAplicacao("A cópia não confere: dossie.json", 500);
  };
  definirConversaoAoCriar((ws) => converterDadosAntigos(dados, ws, { copiar: falhar }));
  const r = await app.inject({ method: "POST", url: "/api/workspace", headers: host, payload: { local } });
  assert.equal(r.statusCode, 500);
  assert.match(r.json().erro, /^A conversão dos dados antigos falhou: A cópia não confere: dossie\.json\. Os dados originais continuam em dados\/\.$/);
  assert.equal(existsSync(join(local, "Gangoy-workspace")), false);
  assert.ok(existsSync(join(dados, "app.db")));
  assert.ok(existsSync(join(dados, "projetos", "leo-e-o-dragao", "dossie.json")));
});

test("dados/lixeira não é tocada", async () => {
  const { dados, local } = await ambienteComDadosAntigos();
  criarOuReconhecerWorkspace(local);
  assert.ok(existsSync(join(dados, "lixeira", "teste-antigo", "dossie.json")));
});

test("apagar dados antigos remove só app.db.migrado e projetos.migrado", async () => {
  const { dados, local, app } = await ambienteComDadosAntigos();
  criarOuReconhecerWorkspace(local);
  const lista = await app.inject({ url: "/api/workspace/dados-antigos", headers: host });
  const nomes = lista.json().itens.map((item: { nome: string }) => item.nome).sort();
  assert.deepEqual(nomes.filter((n: string) => !n.includes("-wal") && !n.includes("-shm")), ["app.db.migrado", "projetos.migrado"]);
  for (const item of lista.json().itens) if (!/-(wal|shm)/.test(item.nome)) assert.ok(item.bytes > 0, item.nome);
  const apagar = await app.inject({ method: "DELETE", url: "/api/workspace/dados-antigos", headers: host });
  assert.equal(apagar.statusCode, 204);
  assert.deepEqual(readdirSync(dados).sort(), ["configuracao-local.json", "lixeira"]);
  const deNovo = await app.inject({ method: "DELETE", url: "/api/workspace/dados-antigos", headers: host });
  assert.equal(deNovo.statusCode, 404);
  assert.deepEqual(deNovo.json(), { erro: "Não há dados antigos para apagar" });
});

test("outros arquivos .migrado em dados/ não são listados nem apagados", async () => {
  const { dados, local, app } = await ambienteComDadosAntigos();
  criarOuReconhecerWorkspace(local);
  writeFileSync(join(dados, "notas.migrado"), "do usuário");
  mkdirSync(join(dados, "backup.migrado"));
  const lista = await app.inject({ url: "/api/workspace/dados-antigos", headers: host });
  const nomes = lista.json().itens.map((item: { nome: string }) => item.nome);
  assert.ok(!nomes.includes("notas.migrado") && !nomes.includes("backup.migrado"), nomes.join(", "));
  await app.inject({ method: "DELETE", url: "/api/workspace/dados-antigos", headers: host });
  assert.ok(existsSync(join(dados, "notas.migrado")) && existsSync(join(dados, "backup.migrado")));
});

test("copiarConferindo detecta tamanho diferente", () => {
  const raiz = criarPastaTemporaria("copia");
  pastas.push(raiz);
  const origem = join(raiz, "origem");
  const destino = join(raiz, "destino");
  mkdirSync(join(origem, "sub"), { recursive: true });
  writeFileSync(join(origem, "a.txt"), "abc");
  writeFileSync(join(origem, "sub", "b.txt"), "defg");
  assert.throws(
    () =>
      copiarConferindo(origem, destino, (copiados, total) => {
        if (copiados === total) appendFileSync(join(destino, "a.txt"), "x");
      }),
    /A cópia não confere: a\.txt/,
  );
});

test("falha ao renomear projetos/ desfaz o app.db.migrado", async () => {
  const { dados, local, app } = await ambienteComDadosAntigos();
  definirConversaoAoCriar((ws) =>
    converterDadosAntigos(dados, ws, {
      renomear: (origem: string, alvo: string) => {
        if (alvo.endsWith("projetos.migrado")) throw Object.assign(new Error("busy"), { code: "EBUSY" });
        renameSync(origem, alvo);
      },
    }),
  );
  const r = await app.inject({ method: "POST", url: "/api/workspace", headers: host, payload: { local } });
  assert.equal(r.statusCode, 500);
  assert.equal(r.json().erro, "A conversão dos dados antigos falhou: Arquivo em uso por outro programa. Os dados originais continuam em dados/.");
  assert.ok(existsSync(join(dados, "app.db")));
  assert.equal(existsSync(join(dados, "app.db.migrado")), false);
  assert.ok(existsSync(join(dados, "projetos", "leo-e-o-dragao", "dossie.json")));
  assert.equal(existsSync(join(local, "Gangoy-workspace")), false);
});

test("dados antigos pela metade (app.db já convertido, projetos/ não) → 409 com orientação", async () => {
  const { dados, local, app } = await ambienteComDadosAntigos();
  renameSync(join(dados, "app.db"), join(dados, "app.db.migrado"));
  const r = await app.inject({ method: "POST", url: "/api/workspace", headers: host, payload: { local } });
  assert.equal(r.statusCode, 409);
  assert.deepEqual(r.json(), {
    erro: "Os dados antigos estão pela metade: dados/app.db já foi convertido, mas dados/projetos/ não. Renomeie dados/app.db.migrado de volta para dados/app.db e tente de novo.",
  });
  assert.equal(existsSync(join(local, "Gangoy-workspace")), false);
});
