import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { aguardarFilaOciosa, buscarTarefa, criarTarefa, registrarExecutor } from "../../src/tarefas/fila.js";
import { obterBanco } from "../../src/banco/banco.js";
import { abrirWorkspaceConfigurada, obterPastaWorkspace } from "../../src/workspace/workspace.js";

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));
let ambiente: AmbienteTeste;

beforeEach(async () => {
  ambiente = await criarAmbienteComWorkspace(3988);
});
afterEach(() => ambiente.encerrar());

test("trocar de workspace com tarefa em execução → 409", async () => {
  registrarExecutor("verificar_continuidade", async () => {
    await esperar(400);
    return null;
  });
  criarTarefa({ tipo: "verificar_continuidade", projetoId: null, capituloNumero: 1 });
  await esperar(50);
  const outro = join(ambiente.raiz, "outro");
  mkdirSync(outro);
  for (const [url, payload] of [
    ["/api/workspace", { local: outro }],
    ["/api/workspace/apontar", { caminho: ambiente.workspace }],
  ] as const) {
    const r = await ambiente.app.inject({ method: "POST", url, headers: ambiente.host, payload });
    assert.equal(r.statusCode, 409, url);
    assert.deepEqual(r.json(), { erro: "Há uma tarefa em execução. Aguarde terminar ou cancele antes de trocar de workspace." });
  }
  await aguardarFilaOciosa();
});

test("workspace que volta (HD religado) retoma a fila", async () => {
  registrarExecutor("gerar_roteiro", async () => ({ ok: true }));
  const agora = new Date().toISOString();
  const inserir = obterBanco().prepare(
    "INSERT INTO tarefas (tipo, chave, parametros, status, progresso, mensagem, criada_em) VALUES ('gerar_roteiro', ?, '{}', ?, 0, '', ?)",
  );
  const presa = Number(inserir.run("presa", "executando", agora).lastInsertRowid);
  const esperando = Number(inserir.run("esperando", "na_fila", agora).lastInsertRowid);

  // Servidor reinicia com o HD desligado: o banco não abre.
  const marcador = join(ambiente.workspace, ".gangoy-workspace.json");
  const conteudo = readFileSync(marcador, "utf-8");
  unlinkSync(marcador);
  abrirWorkspaceConfigurada();
  // HD religado: a próxima requisição reabre o banco e a fila deve retomar.
  writeFileSync(marcador, conteudo);
  obterPastaWorkspace();
  await esperar(50);
  await aguardarFilaOciosa();

  assert.equal(buscarTarefa(presa)!.status, "falhou");
  assert.equal(buscarTarefa(presa)!.erro, "Interrompida: o servidor foi fechado durante a execução");
  assert.equal(buscarTarefa(esperando)!.status, "concluida");
});
