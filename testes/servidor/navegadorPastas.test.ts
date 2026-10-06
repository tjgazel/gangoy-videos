import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";
import { listarPastas, criarPasta, listarRaizes } from "../../src/workspace/navegadorPastas.js";
import { ErroAplicacao } from "../../src/nucleo/erros.js";
import { criarPastaTemporaria, removerPasta } from "../apoio/ambiente.js";

const tmp = criarPastaTemporaria("nav");
after(() => removerPasta(tmp));

function erroComStatus(status: number) {
  return (erro: unknown) => erro instanceof ErroAplicacao && erro.status === status;
}

test("lista só subpastas, sem ocultas, em ordem", () => {
  const base = join(tmp, "lista");
  for (const nome of ["b", "A", ".oculta", "$Recycle.Bin", "System Volume Information"]) {
    mkdirSync(join(base, nome), { recursive: true });
  }
  writeFileSync(join(base, "arquivo.txt"), "x");
  const listagem = listarPastas(base);
  assert.deepEqual(listagem.pastas.map((pasta) => pasta.nome), ["A", "b"]);
  assert.equal(listagem.pastas[0]!.caminho, join(base, "A"));
  assert.equal(listagem.pai, tmp);
});

test("pai da raiz é null", () => {
  const raiz = parse(tmp).root;
  assert.equal(listarPastas(raiz).pai, null);
});

test("caminho relativo → 400", () => {
  assert.throws(() => listarPastas("relativo/pasta"), erroComStatus(400));
  assert.throws(() => listarPastas("relativo/pasta"), /Informe um caminho absoluto/);
});

test("sem permissão → 403", () => {
  const ler = () => {
    throw Object.assign(new Error("x"), { code: "EPERM" });
  };
  assert.throws(() => listarPastas(tmp, ler), erroComStatus(403));
  assert.throws(() => listarPastas(tmp, ler), /Sem permissão para abrir esta pasta/);
});

test("pasta inexistente → 404", () => {
  assert.throws(() => listarPastas(join(tmp, "nao-existe")), erroComStatus(404));
  assert.throws(() => listarPastas(join(tmp, "nao-existe")), /Pasta não encontrada/);
});

test("criar pasta com nome inválido → 400; já existente → 409", () => {
  assert.throws(() => criarPasta(tmp, "a/b"), erroComStatus(400));
  const criada = criarPasta(tmp, "Meus Vídeos");
  assert.equal(criada.caminho, join(tmp, "Meus Vídeos"));
  assert.throws(() => criarPasta(tmp, "Meus Vídeos"), erroComStatus(409));
  assert.throws(() => criarPasta(tmp, "Meus Vídeos"), /Já existe uma pasta com esse nome/);
});

test("raízes: unidades no Windows, / e pasta pessoal no Linux", () => {
  const linux = listarRaizes("linux");
  assert.equal(linux[0]!.caminho, "/");
  assert.equal(linux.length, 2);
  if (process.platform === "win32") {
    assert.ok(listarRaizes("win32").some((raiz) => /^[A-Z]:\\$/.test(raiz.caminho)));
  }
});

test("rotas: GET sem caminho devolve raízes; POST cria pasta (201)", async () => {
  const { criarApp } = await import("../../src/servidor/app.js");
  const app = await criarApp({ porta: 3995, pastaDados: join(tmp, "dados"), urlOllama: "http://127.0.0.1:9" });
  const host = { host: "localhost:3995" };
  const raizes = await app.inject({ url: "/api/sistema/pastas", headers: host });
  assert.equal(raizes.statusCode, 200);
  assert.equal(raizes.json().caminho, null);
  assert.ok(raizes.json().raizes.length > 0);
  const lista = await app.inject({ url: `/api/sistema/pastas?caminho=${encodeURIComponent(tmp)}`, headers: host });
  assert.equal(lista.json().caminho, tmp);
  assert.ok(lista.json().raizes.length > 0);
  const nova = await app.inject({ method: "POST", url: "/api/sistema/pastas", headers: host, payload: { caminhoPai: tmp, nome: "Nova" } });
  assert.equal(nova.statusCode, 201);
  assert.equal(nova.json().caminho, join(tmp, "Nova"));
  await app.close();
});
