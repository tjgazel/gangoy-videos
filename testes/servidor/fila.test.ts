import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { abrirBanco, fecharBanco, obterBanco } from "../../src/banco/banco.js";
import {
  aguardarFilaOciosa,
  buscarTarefa,
  cancelarTarefa,
  criarTarefa,
  iniciarFila,
  pararFila,
  prepararFilaAoIniciar,
  registrarExecutor,
  repetirTarefa,
} from "../../src/tarefas/fila.js";
import { assinarEventos, type Evento } from "../../src/tarefas/eventos.js";
import { ErroAplicacao } from "../../src/nucleo/erros.js";
import { criarPastaTemporaria, removerPasta } from "../apoio/ambiente.js";

const tmp = criarPastaTemporaria("fila");
const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));
let capitulo = 0; // chaves diferentes em cada tarefa (projetoId nulo, sem FK)
const nova = (tipo: "gerar_roteiro" | "refazer_roteiro" = "gerar_roteiro", parametros = {}) =>
  criarTarefa({ tipo, projetoId: null, capituloNumero: ++capitulo, parametros });

before(() => {
  abrirBanco(join(tmp, "fila.db"));
  iniciarFila();
});
beforeEach(() => obterBanco().exec("DELETE FROM tarefas"));
after(async () => {
  await pararFila();
  fecharBanco();
  removerPasta(tmp);
});

test("executa em ordem, uma por vez", async () => {
  const registro: string[] = [];
  let emExecucao = 0;
  registrarExecutor("gerar_roteiro", async (tarefa) => {
    emExecucao++;
    assert.equal(emExecucao, 1);
    registro.push(`inicio ${tarefa.capituloNumero}`);
    await esperar(20);
    registro.push(`fim ${tarefa.capituloNumero}`);
    emExecucao--;
    return null;
  });
  const [a, b, c] = [nova(), nova(), nova()];
  await aguardarFilaOciosa();
  const n = (t: typeof a) => t.capituloNumero;
  assert.deepEqual(registro, [`inicio ${n(a)}`, `fim ${n(a)}`, `inicio ${n(b)}`, `fim ${n(b)}`, `inicio ${n(c)}`, `fim ${n(c)}`]);
});

test("chave duplicada na fila → 409", async () => {
  registrarExecutor("gerar_roteiro", async () => {
    await esperar(30);
    return null;
  });
  criarTarefa({ tipo: "gerar_roteiro", projetoId: null, capituloNumero: 900 });
  assert.throws(
    () => criarTarefa({ tipo: "gerar_roteiro", projetoId: null, capituloNumero: 900 }),
    (erro) => erro instanceof ErroAplicacao && erro.status === 409 && erro.message === "Já existe uma tarefa para isso",
  );
  await aguardarFilaOciosa();
});

test("concluída guarda resultado e progresso 100", async () => {
  registrarExecutor("gerar_roteiro", async () => ({ versao: 3 }));
  const tarefa = nova();
  await aguardarFilaOciosa();
  const final = buscarTarefa(tarefa.id)!;
  assert.equal(final.status, "concluida");
  assert.equal(final.progresso, 100);
  assert.deepEqual(final.resultado, { versao: 3 });
  assert.ok(final.iniciadaEm && final.concluidaEm);
});

test("ErroAplicacao → falhou com a mensagem", async () => {
  registrarExecutor("gerar_roteiro", async () => {
    throw new ErroAplicacao("Sem dossiê");
  });
  const tarefa = nova();
  await aguardarFilaOciosa();
  const final = buscarTarefa(tarefa.id)!;
  assert.equal(final.status, "falhou");
  assert.equal(final.erro, "Sem dossiê");
});

test("cancelar na fila → cancelada sem executar", async () => {
  const executadas: number[] = [];
  registrarExecutor("gerar_roteiro", async (tarefa) => {
    executadas.push(tarefa.id);
    await esperar(30);
    return null;
  });
  const primeira = nova();
  const segunda = nova();
  assert.equal(cancelarTarefa(segunda.id).status, "cancelada");
  await aguardarFilaOciosa();
  assert.deepEqual(executadas, [primeira.id]);
  assert.equal(buscarTarefa(segunda.id)!.status, "cancelada");
});

test("cancelar em execução aborta o sinal → cancelada", async () => {
  let abortado = false;
  registrarExecutor("gerar_roteiro", async (_tarefa, contexto) => {
    await new Promise<void>((pronto) => contexto.sinal.addEventListener("abort", () => pronto()));
    abortado = true;
    throw Object.assign(new Error("abortado"), { name: "AbortError" });
  });
  const tarefa = nova();
  await esperar(20);
  assert.equal(buscarTarefa(tarefa.id)!.status, "executando");
  cancelarTarefa(tarefa.id);
  await aguardarFilaOciosa();
  assert.equal(abortado, true);
  assert.equal(buscarTarefa(tarefa.id)!.status, "cancelada");
});

test("repetir cria tarefa nova com os mesmos parâmetros (só de falhou/cancelada)", async () => {
  registrarExecutor("refazer_roteiro", async () => {
    throw new ErroAplicacao("Falhou");
  });
  const tarefa = nova("refazer_roteiro", { instrucao: "corrigir o rio" });
  await aguardarFilaOciosa();
  registrarExecutor("refazer_roteiro", async () => "ok");
  const repetida = repetirTarefa(tarefa.id);
  assert.notEqual(repetida.id, tarefa.id);
  assert.deepEqual(repetida.parametros, { instrucao: "corrigir o rio" });
  await aguardarFilaOciosa();
  assert.equal(buscarTarefa(repetida.id)!.status, "concluida");
  assert.throws(() => repetirTarefa(repetida.id), (erro) => erro instanceof ErroAplicacao && erro.status === 409);
});

test("ao iniciar: executando vira falhou com 'Interrompida…'", () => {
  obterBanco()
    .prepare(
      "INSERT INTO tarefas (tipo, chave, parametros, status, progresso, mensagem, criada_em, iniciada_em) VALUES ('gerar_roteiro', 'x:1', '{}', 'executando', 40, '', ?, ?)",
    )
    .run(new Date().toISOString(), new Date().toISOString());
  prepararFilaAoIniciar();
  const linha = obterBanco().prepare("SELECT status, erro FROM tarefas WHERE chave = 'x:1'").get() as { status: string; erro: string };
  assert.equal(linha.status, "falhou");
  assert.equal(linha.erro, "Interrompida: o servidor foi fechado durante a execução");
});

test("ao iniciar: status final há mais de 30 dias é apagado; na_fila continua", () => {
  const antiga = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
  const inserir = obterBanco().prepare(
    "INSERT INTO tarefas (tipo, chave, parametros, status, progresso, mensagem, criada_em, concluida_em) VALUES ('gerar_roteiro', ?, '{}', ?, 0, '', ?, ?)",
  );
  inserir.run("velha", "concluida", antiga, antiga);
  inserir.run("recente", "falhou", new Date().toISOString(), new Date().toISOString());
  inserir.run("esperando", "na_fila", antiga, null);
  prepararFilaAoIniciar();
  const chaves = (obterBanco().prepare("SELECT chave FROM tarefas ORDER BY chave").all() as { chave: string }[]).map((l) => l.chave);
  assert.deepEqual(chaves, ["esperando", "recente"]);
});

test("cada mudança emite evento 'tarefa'", async () => {
  registrarExecutor("gerar_roteiro", async (_tarefa, contexto) => {
    contexto.relatarProgresso(50, "Gerando roteiro");
    return null;
  });
  const eventos: Evento[] = [];
  const cancelar = assinarEventos((evento) => eventos.push(evento));
  const tarefa = nova();
  await aguardarFilaOciosa();
  cancelar();
  const daTarefa = eventos.filter((e) => e.tipo === "tarefa" && e.dados.id === tarefa.id).map((e) => e.dados as { status: string; progresso: number });
  assert.deepEqual(
    daTarefa.map((t) => `${t.status}:${t.progresso}`),
    ["na_fila:0", "executando:0", "executando:50", "concluida:100"],
  );
});

test("erro do banco durante a execução não derruba o processo", async () => {
  let rejeicoes = 0;
  const contar = () => rejeicoes++;
  process.on("unhandledRejection", contar);
  const eventos: string[] = [];
  const cancelar = assinarEventos((evento) => {
    if (evento.tipo === "tarefa") eventos.push(evento.dados.status);
  });
  registrarExecutor("gerar_roteiro", async () => {
    // Simula o disco sumindo: a tabela deixa de existir para o UPDATE final.
    obterBanco().exec("ALTER TABLE tarefas RENAME TO tarefas_fora");
    throw new ErroAplicacao("Workspace não encontrada em X", 503);
  });
  nova();
  await esperar(150);
  obterBanco().exec("ALTER TABLE tarefas_fora RENAME TO tarefas");
  await aguardarFilaOciosa();
  cancelar();
  process.off("unhandledRejection", contar);
  assert.equal(rejeicoes, 0);
  assert.ok(eventos.includes("falhou"));
});
