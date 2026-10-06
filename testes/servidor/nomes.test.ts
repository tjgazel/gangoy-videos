import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { gerarSlug, validarNomeSimples, garantirDentroDe } from "../../src/nucleo/nomes.js";

test("slug sem acento", () => assert.equal(gerarSlug("Léo e o Dragão"), "leo-e-o-dragao"));

test("slug reservado do Windows", () => {
  assert.equal(gerarSlug("CON"), "con-projeto");
  assert.equal(gerarSlug("com1"), "com1-projeto");
});

test("nome simples recusa separador, .., reservado e ponto final", () => {
  for (const nome of ["a/b", "a\\b", "..", "nul", "con.txt", "pasta.", "pasta .", "a:b", ""]) {
    assert.throws(() => validarNomeSimples(nome), Error, nome);
  }
  assert.equal(validarNomeSimples(" Meus Vídeos "), "Meus Vídeos");
});

test("dentro da workspace (posix e win32)", () => {
  assert.throws(() => garantirDentroDe("/ws", "/ws/../etc", path.posix));
  assert.throws(() => garantirDentroDe("C:\\ws", "D:\\outro", path.win32));
  assert.equal(garantirDentroDe("C:\\ws", "C:\\ws\\leo\\dossie.json", path.win32), "C:\\ws\\leo\\dossie.json");
});
