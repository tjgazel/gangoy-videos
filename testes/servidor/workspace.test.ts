import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { criarApp } from "../../src/servidor/app.js";
import { fecharBanco } from "../../src/banco/banco.js";
import { abrirWorkspaceConfigurada, criarOuReconhecerWorkspace } from "../../src/workspace/workspace.js";
import { criarProjeto } from "../../src/projetos/projetos.js";
import { salvarDossie, lerDossie, esquemaDossie } from "../../src/dossie/dossie.js";
import { salvarNovaVersaoRoteiro } from "../../src/capitulos/capitulos.js";
import { criarPastaTemporaria, removerPasta } from "../apoio/ambiente.js";

const PORTA = 3997;
const host = { host: `localhost:${PORTA}` };
const pastas: string[] = [];
const apps: FastifyInstance[] = [];
const semBanco = (caminho: string) =>
  `A workspace em ${caminho} está sem o arquivo gangoy.db. Restaure-o de um backup ou aponte outro local.`;

after(async () => {
  for (const app of apps) await app.close();
  fecharBanco();
  for (const pasta of pastas) removerPasta(pasta);
});

// Cada teste tem a sua pasta de dados e o seu local de workspace. Ollama aponta para porta fechada.
async function novoAmbiente(nomeLocal = "local") {
  const raiz = criarPastaTemporaria("ws");
  pastas.push(raiz);
  const dados = join(raiz, "dados");
  const local = join(raiz, nomeLocal);
  mkdirSync(local, { recursive: true });
  const app = await criarApp({ porta: PORTA, pastaDados: dados, urlOllama: "http://127.0.0.1:9" });
  apps.push(app);
  return { raiz, dados, local, app };
}

test("cria Gangoy-workspace com marcador e banco", async () => {
  const { local } = await novoAmbiente();
  const r = criarOuReconhecerWorkspace(local);
  assert.equal(r.criada, true);
  assert.equal(r.caminho, join(local, "Gangoy-workspace"));
  assert.ok(existsSync(join(local, "Gangoy-workspace", ".gangoy-workspace.json")));
  assert.ok(existsSync(join(local, "Gangoy-workspace", "gangoy.db")));
});

test("reconhece workspace existente (apontando o local ou a própria pasta)", async () => {
  const { local } = await novoAmbiente();
  const primeira = criarOuReconhecerWorkspace(local);
  const peloLocal = criarOuReconhecerWorkspace(local);
  const pelaPasta = criarOuReconhecerWorkspace(primeira.caminho);
  assert.equal(peloLocal.criada, false);
  assert.equal(pelaPasta.criada, false);
  assert.equal(peloLocal.caminho, primeira.caminho);
  assert.equal(pelaPasta.caminho, primeira.caminho);
});

test("pasta Gangoy-workspace não vazia e sem marcador → 409", async () => {
  const { local, app } = await novoAmbiente();
  mkdirSync(join(local, "Gangoy-workspace"));
  writeFileSync(join(local, "Gangoy-workspace", "qualquer.txt"), "x");
  const r = await app.inject({ method: "POST", url: "/api/workspace", headers: host, payload: { local } });
  assert.equal(r.statusCode, 409);
});

test("local inexistente → 400", async () => {
  const { raiz, app } = await novoAmbiente();
  const r = await app.inject({ method: "POST", url: "/api/workspace", headers: host, payload: { local: join(raiz, "nao-existe") } });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.json(), { erro: "A pasta escolhida não existe" });
});

test("caminho com espaço e acento", async () => {
  const { local } = await novoAmbiente("Meus Vídeos ação");
  assert.equal(criarOuReconhecerWorkspace(local).criada, true);
  const projeto = criarProjeto(esquemaDossieProjeto("Léo e o Dragão"));
  salvarDossie(projeto.slug, esquemaDossie.parse({ sinopse: "Uma história" }));
  assert.equal(lerDossie(projeto.slug)?.sinopse, "Uma história");
  assert.ok(existsSync(join(local, "Gangoy-workspace", "leo-e-o-dragao", "dossie.json")));
});

test("workspace ausente → rotas de dados respondem 503", async () => {
  const { local, app } = await novoAmbiente();
  const { caminho } = criarOuReconhecerWorkspace(local);
  unlinkSync(join(caminho, ".gangoy-workspace.json"));
  const r = await app.inject({ url: "/api/projetos", headers: host });
  assert.equal(r.statusCode, 503);
  assert.deepEqual(r.json(), { erro: `Workspace não encontrada em ${caminho}` });
});

// Marcador presente, banco sumido (apagado, ou backup copiado pela metade).
function apagarBanco(caminho: string): void {
  fecharBanco();
  for (const nome of ["gangoy.db", "gangoy.db-wal", "gangoy.db-shm"]) rmSync(join(caminho, nome), { force: true });
}

test("workspace sem gangoy.db ao iniciar → 503 explicando, sem criar banco vazio", async () => {
  const { local, app } = await novoAmbiente();
  const { caminho } = criarOuReconhecerWorkspace(local);
  apagarBanco(caminho);
  abrirWorkspaceConfigurada();
  const r = await app.inject({ url: "/api/projetos", headers: host });
  assert.equal(r.statusCode, 503);
  assert.deepEqual(r.json(), { erro: semBanco(caminho) });
  assert.equal(existsSync(join(caminho, "gangoy.db")), false);
  const status = (await app.inject({ url: "/api/sistema/status", headers: host })).json();
  assert.equal(status.workspace.disponivel, false);
  assert.equal(status.workspace.semBanco, true);
});

test("reconhecer workspace sem gangoy.db → 409, sem criar banco vazio", async () => {
  const { local, app } = await novoAmbiente();
  const { caminho } = criarOuReconhecerWorkspace(local);
  apagarBanco(caminho);
  const r = await app.inject({ method: "POST", url: "/api/workspace", headers: host, payload: { local } });
  assert.equal(r.statusCode, 409);
  assert.deepEqual(r.json(), { erro: semBanco(caminho) });
  assert.equal(existsSync(join(caminho, "gangoy.db")), false);
});

test("sem workspace configurada → 503", async () => {
  const { app } = await novoAmbiente();
  const r = await app.inject({ url: "/api/projetos", headers: host });
  assert.equal(r.statusCode, 503);
  assert.deepEqual(r.json(), { erro: "Nenhuma workspace configurada. Escolha o local na tela de boas-vindas." });
});

test("rotas /api/sistema/*, /api/workspace* e /api/configuracoes/app funcionam sem workspace", async () => {
  const { local, app } = await novoAmbiente();
  assert.equal((await app.inject({ url: "/api/sistema/status", headers: host })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/configuracoes/app", headers: host })).statusCode, 200);
  const criar = await app.inject({ method: "POST", url: "/api/workspace", headers: host, payload: { local } });
  assert.equal(criar.statusCode, 200);
  assert.equal(criar.json().criada, true);
});

test("apontar pasta que não é workspace → 400", async () => {
  const { local, app } = await novoAmbiente();
  const r = await app.inject({ method: "POST", url: "/api/workspace/apontar", headers: host, payload: { caminho: local } });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.json(), { erro: "Esta pasta não é uma workspace do Gangoy Vídeos" });
});

test("excluir projeto move a pasta para <workspace>/.lixeira/<slug>-<data>", async () => {
  const { local, app } = await novoAmbiente();
  const { caminho } = criarOuReconhecerWorkspace(local);
  const projeto = criarProjeto(esquemaDossieProjeto("Fábulas"));
  const r = await app.inject({ method: "DELETE", url: `/api/projetos/${projeto.id}`, headers: host });
  assert.equal(r.statusCode, 200);
  assert.ok(r.json().pastaLixeira.startsWith(join(caminho, ".lixeira", "fabulas-")));
  assert.ok(existsSync(r.json().pastaLixeira));
  assert.equal(existsSync(join(caminho, "fabulas")), false);
});

test("roteiro grava em capitulos/capitulo-001/roteiro/roteiro_v1.json", async () => {
  const { local } = await novoAmbiente();
  const { caminho } = criarOuReconhecerWorkspace(local);
  salvarNovaVersaoRoteiro("leo", 1, {
    instrucao: "",
    roteiro: { titulo: "T", cenas: [] },
    palavras: 0,
    minutosEstimados: 0,
  });
  assert.ok(existsSync(join(caminho, "leo", "capitulos", "capitulo-001", "roteiro", "roteiro_v1.json")));
});

test("status informa workspace e Ollama offline", async () => {
  const { local, app } = await novoAmbiente();
  const { caminho } = criarOuReconhecerWorkspace(local);
  const status = (await app.inject({ url: "/api/sistema/status", headers: host })).json();
  assert.equal(status.workspace.configurada, true);
  assert.equal(status.workspace.disponivel, true);
  assert.equal(status.workspace.caminho, caminho);
  assert.equal(typeof status.workspace.espacoLivreBytes, "number");
  assert.equal(status.ollama.online, false);
  assert.equal(status.ollama.url, "http://127.0.0.1:9");
});

function esquemaDossieProjeto(nome: string) {
  return {
    nome,
    tematica: "",
    idCanal: "",
    idPlaylist: "",
    frequencia: "semanal:ter:18:00",
    duracaoPadraoMinutos: 8,
    modeloOllama: "",
  };
}
