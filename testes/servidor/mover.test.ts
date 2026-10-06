import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { moverWorkspace } from "../../src/workspace/mover.js";
import { copiarConferindoAssincrono } from "../../src/workspace/copiaConferida.js";
import { estadoWorkspace, obterPastaWorkspace } from "../../src/workspace/workspace.js";
import { lerConfiguracaoLocal } from "../../src/workspace/configuracaoLocal.js";
import { criarProjeto, listarProjetos } from "../../src/projetos/projetos.js";
import { ErroAplicacao } from "../../src/nucleo/erros.js";
import type { ContextoExecucao } from "../../src/tarefas/tipos.js";
import { aguardarFilaOciosa, buscarTarefa } from "../../src/tarefas/fila.js";

let ambiente: AmbienteTeste;
let destino: string;
const progresso: string[] = [];
const contexto: ContextoExecucao = {
  sinal: new AbortController().signal,
  relatarProgresso: (_p, mensagem) => progresso.push(mensagem),
};

beforeEach(async () => {
  ambiente = await criarAmbienteComWorkspace(3993);
  destino = join(ambiente.raiz, "outro disco");
  mkdirSync(destino);
  criarProjeto({ nome: "Léo", tematica: "", idCanal: "", idPlaylist: "", frequencia: "diaria", duracaoPadraoMinutos: 8, modeloOllama: "" });
  writeFileSync(join(ambiente.workspace, "leo", "dossie.json"), "{}");
  progresso.length = 0;
});
afterEach(() => ambiente.encerrar());

const exdev = () => {
  throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
};

test("mesmo disco: renomeia e grava o novo caminho", async () => {
  const resultado = await moverWorkspace(destino, contexto);
  const novo = join(destino, "Gangoy-workspace");
  assert.equal(resultado.caminho, novo);
  assert.equal(lerConfiguracaoLocal().pastaWorkspace, novo);
  assert.equal(existsSync(ambiente.workspace), false);
  assert.ok(existsSync(join(novo, "leo", "dossie.json")));
  assert.equal(listarProjetos().length, 1);
  assert.equal(estadoWorkspace().movendo, false);
});

test("EXDEV: copia, confere e apaga a origem", async () => {
  const resultado = await moverWorkspace(destino, contexto, { renomear: exdev });
  assert.ok(existsSync(join(resultado.caminho, "leo", "dossie.json")));
  assert.equal(existsSync(ambiente.workspace), false);
  assert.equal(listarProjetos().length, 1);
  assert.ok(progresso.some((m) => /^Copiando arquivos \(\d+ de \d+\)$/.test(m)));
});

test("falha no meio da cópia: destino removido, origem válida e banco reaberto na origem", async () => {
  const falharNoMeio: typeof copiarConferindoAssincrono = async (origem, alvo) => {
    await copiarConferindoAssincrono(origem, alvo);
    throw new ErroAplicacao("A cópia não confere: leo/dossie.json", 500);
  };
  await assert.rejects(moverWorkspace(destino, contexto, { renomear: exdev, copiar: falharNoMeio }), /A cópia não confere/);
  assert.equal(existsSync(join(destino, "Gangoy-workspace")), false);
  assert.ok(existsSync(join(ambiente.workspace, "leo", "dossie.json")));
  assert.equal(lerConfiguracaoLocal().pastaWorkspace, ambiente.workspace);
  assert.equal(listarProjetos().length, 1);
  assert.equal(estadoWorkspace().movendo, false);
});

test("destino com outra workspace → 409", async () => {
  mkdirSync(join(destino, "Gangoy-workspace"));
  writeFileSync(join(destino, "Gangoy-workspace", ".gangoy-workspace.json"), "{}");
  await assert.rejects(
    moverWorkspace(destino, contexto),
    (erro) => erro instanceof ErroAplicacao && erro.status === 409 && erro.message === "O destino já tem uma workspace",
  );
});

test("espaço livre insuficiente → 409", async () => {
  await assert.rejects(
    moverWorkspace(destino, contexto, { espacoLivre: () => 1 }),
    (erro) => erro instanceof ErroAplicacao && erro.status === 409 && erro.message === "Espaço livre insuficiente no destino",
  );
});

test("rotas de dados respondem 503 durante a mudança", async () => {
  let mensagem = "";
  const copiarObservando: typeof copiarConferindoAssincrono = (origem, alvo, opcoes) => {
    try {
      obterPastaWorkspace();
    } catch (erro) {
      mensagem = `${(erro as ErroAplicacao).status} ${(erro as Error).message}`;
    }
    return copiarConferindoAssincrono(origem, alvo, opcoes);
  };
  await moverWorkspace(destino, contexto, { renomear: exdev, copiar: copiarObservando });
  assert.equal(mensagem, "503 A workspace está sendo movida. Aguarde a conclusão.");
});

test("rota valida antes de enfileirar e responde 202", async () => {
  const { app, host } = ambiente;
  const invalido = await app.inject({ method: "POST", url: "/api/workspace/mover", headers: host, payload: { destino: join(ambiente.raiz, "nao-existe") } });
  assert.equal(invalido.statusCode, 400);
  assert.deepEqual(invalido.json(), { erro: "A pasta de destino não existe" });
  const ok = await app.inject({ method: "POST", url: "/api/workspace/mover", headers: host, payload: { destino } });
  assert.equal(ok.statusCode, 202);
  await aguardarFilaOciosa();
  assert.equal(buscarTarefa(ok.json().tarefaId)?.status, "concluida");
  assert.ok(existsSync(join(destino, "Gangoy-workspace", "leo", "dossie.json")));
});

test("falha ao apagar a origem vira aviso; a workspace nova já está em uso", async () => {
  const apagar = () => {
    throw Object.assign(new Error("busy"), { code: "EBUSY" });
  };
  const resultado = await moverWorkspace(destino, contexto, { renomear: exdev, apagar });
  const novo = join(destino, "Gangoy-workspace");
  assert.equal(resultado.caminho, novo);
  assert.equal(resultado.aviso, `Não foi possível apagar tudo em ${ambiente.workspace}; apague à mão.`);
  assert.equal(lerConfiguracaoLocal().pastaWorkspace, novo);
  assert.equal(listarProjetos().length, 1);
});

test("a cópia não trava o servidor: o progresso sai enquanto copia", async () => {
  let eventLoopLivre = false;
  let livreNoPrimeiroArquivo: boolean | null = null;
  const observar: ContextoExecucao = {
    sinal: new AbortController().signal,
    relatarProgresso: (_p, mensagem) => {
      if (mensagem.startsWith("Copiando") && livreNoPrimeiroArquivo === null) livreNoPrimeiroArquivo = eventLoopLivre;
    },
  };
  setImmediate(() => (eventLoopLivre = true));
  await moverWorkspace(destino, observar, { renomear: exdev });
  assert.equal(livreNoPrimeiroArquivo, true);
});

test("cancelar durante a cópia: destino removido, origem válida", async () => {
  const controle = new AbortController();
  const cancelavel: ContextoExecucao = {
    sinal: controle.signal,
    relatarProgresso: (_p, mensagem) => {
      if (mensagem.startsWith("Copiando")) controle.abort();
    },
  };
  await assert.rejects(moverWorkspace(destino, cancelavel, { renomear: exdev }), { name: "AbortError" });
  assert.equal(existsSync(join(destino, "Gangoy-workspace")), false);
  assert.equal(lerConfiguracaoLocal().pastaWorkspace, ambiente.workspace);
  assert.equal(listarProjetos().length, 1);
});
