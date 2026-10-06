import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { criarAmbienteComWorkspace, type AmbienteTeste } from "../apoio/ambiente.js";
import { aguardarFilaOciosa, criarTarefa, registrarExecutor } from "../../src/tarefas/fila.js";
import { assinarEventos, type Evento } from "../../src/tarefas/eventos.js";
import { iniciarMonitorSistema, pararMonitorSistema } from "../../src/sistema/monitor.js";
import { criarProjeto } from "../../src/projetos/projetos.js";

const PORTA = 3994;
const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));
let ambiente: AmbienteTeste;

before(async () => {
  ambiente = await criarAmbienteComWorkspace(PORTA);
  registrarExecutor("gerar_roteiro", async () => {
    await esperar(10);
    return { versao: 1 };
  });
  registrarExecutor("verificar_continuidade", async () => {
    throw new Error("falhou de propósito");
  });
});
after(() => ambiente.encerrar());

const projeto = (nome: string) =>
  criarProjeto({ nome, tematica: "", idCanal: "", idPlaylist: "", frequencia: "diaria", duracaoPadraoMinutos: 8, modeloOllama: "" });

test("lista e filtra por status e projeto", async () => {
  const { app, host } = ambiente;
  const a = projeto("Projeto A");
  const b = projeto("Projeto B");
  criarTarefa({ tipo: "gerar_roteiro", projetoId: a.id, capituloNumero: 1 });
  criarTarefa({ tipo: "verificar_continuidade", projetoId: b.id, capituloNumero: 1 });
  await aguardarFilaOciosa();

  const doA = (await app.inject({ url: `/api/tarefas?projetoId=${a.id}`, headers: host })).json();
  assert.deepEqual(doA.map((t: { projetoId: number }) => t.projetoId), [a.id]);
  const falhas = (await app.inject({ url: "/api/tarefas?status=falhou,cancelada", headers: host })).json();
  assert.deepEqual(falhas.map((t: { tipo: string }) => t.tipo), ["verificar_continuidade"]);

  const detalhe = await app.inject({ url: `/api/tarefas/${doA[0].id}`, headers: host });
  assert.deepEqual(detalhe.json().resultado, { versao: 1 });
  assert.equal((await app.inject({ url: "/api/tarefas/99999", headers: host })).statusCode, 404);

  const repetir = await app.inject({ method: "POST", url: `/api/tarefas/${falhas[0].id}/repetir`, headers: host });
  assert.equal(repetir.statusCode, 202);
  assert.equal(typeof repetir.json().tarefaId, "number");
  await aguardarFilaOciosa();
});

test("SSE entrega event: tarefa ao criar uma tarefa", async () => {
  const { app } = ambiente;
  await app.listen({ port: PORTA, host: "127.0.0.1" });
  const controle = new AbortController();
  const resposta = await fetch(`http://127.0.0.1:${PORTA}/api/eventos`, { signal: controle.signal });
  assert.equal(resposta.headers.get("content-type"), "text/event-stream");
  const leitor = resposta.body!.getReader();
  const p = projeto("Projeto SSE");
  const criada = criarTarefa({ tipo: "gerar_roteiro", projetoId: p.id, capituloNumero: 7 });

  let texto = "";
  const decodificador = new TextDecoder();
  while (!texto.includes(`"id":${criada.id},`)) {
    const { value, done } = await leitor.read();
    if (done) break;
    texto += decodificador.decode(value);
  }
  assert.match(texto, /retry: 3000/);
  assert.match(texto, new RegExp(`event: tarefa\\ndata: \\{"id":${criada.id},`));
  controle.abort();
  await aguardarFilaOciosa();
});

test("monitor emite 'sistema' só quando o status muda", async () => {
  pararMonitorSistema();
  const eventos: Evento[] = [];
  const cancelar = assinarEventos((evento) => {
    if (evento.tipo === "sistema") eventos.push(evento);
  });
  iniciarMonitorSistema(50);
  await esperar(250);
  assert.equal(eventos.length, 0);
  unlinkSync(join(ambiente.workspace, ".gangoy-workspace.json"));
  await esperar(250);
  pararMonitorSistema();
  cancelar();
  assert.equal(eventos.length, 1);
  assert.equal((eventos[0]!.dados as { workspace: { disponivel: boolean } }).workspace.disponivel, false);
});

test("monitor não derruba o processo se a consulta de status falhar", async () => {
  pararMonitorSistema();
  let rejeicoes = 0;
  const contar = () => rejeicoes++;
  process.on("unhandledRejection", contar);
  iniciarMonitorSistema(30, async () => {
    throw new Error("statfs falhou");
  });
  await esperar(150);
  pararMonitorSistema();
  process.off("unhandledRejection", contar);
  assert.equal(rejeicoes, 0);
});
