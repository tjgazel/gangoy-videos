import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ErroAplicacao } from "../nucleo/erros.js";
import { buscarTarefa, cancelarTarefa, listarTarefas, repetirTarefa } from "../tarefas/fila.js";
import { assinarEventos } from "../tarefas/eventos.js";
import type { StatusTarefa } from "../tarefas/tipos.js";

const STATUS: StatusTarefa[] = ["na_fila", "executando", "concluida", "falhou", "cancelada"];
const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const INTERVALO_PING_MS = 20000;

export function registrarRotasTarefas(app: FastifyInstance): void {
  app.get<{ Querystring: { projetoId?: string; status?: string } }>("/api/tarefas", async (requisicao) => {
    const { projetoId, status } = requisicao.query;
    const listaStatus = status
      ? status.split(",").map((s) => z.enum(STATUS).parse(s.trim()))
      : undefined;
    return listarTarefas({
      projetoId: projetoId ? z.coerce.number().int().positive().parse(projetoId) : undefined,
      status: listaStatus,
    });
  });

  app.get<{ Params: { id: string } }>("/api/tarefas/:id", async (requisicao) => {
    const tarefa = buscarTarefa(esquemaId.parse(requisicao.params).id);
    if (!tarefa) throw new ErroAplicacao("Tarefa não encontrada", 404);
    return tarefa;
  });

  app.post<{ Params: { id: string } }>("/api/tarefas/:id/cancelar", async (requisicao) =>
    cancelarTarefa(esquemaId.parse(requisicao.params).id),
  );

  app.post<{ Params: { id: string } }>("/api/tarefas/:id/repetir", async (requisicao, resposta) => {
    const nova = repetirTarefa(esquemaId.parse(requisicao.params).id);
    return resposta.code(202).send({ tarefaId: nova.id });
  });

  // Server-Sent Events: a interface recebe mudanças de tarefas e de status sem perguntar.
  app.get("/api/eventos", (requisicao, resposta) => {
    resposta.hijack();
    const saida = resposta.raw;
    saida.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    saida.write("retry: 3000\n\n");

    const cancelarAssinatura = assinarEventos((evento) => {
      saida.write(`event: ${evento.tipo}\ndata: ${JSON.stringify(evento.dados)}\n\n`);
    });
    const ping = setInterval(() => saida.write(": ping\n\n"), INTERVALO_PING_MS);
    ping.unref();

    requisicao.raw.on("close", () => {
      clearInterval(ping);
      cancelarAssinatura();
    });
  });
}
