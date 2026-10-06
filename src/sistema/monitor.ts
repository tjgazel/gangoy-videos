import { emitirEvento } from "../tarefas/eventos.js";
import { obterStatusSistema, type StatusSistema } from "./status.js";

// Verifica o status do Ollama e da workspace periodicamente e avisa a interface quando muda.

let temporizador: NodeJS.Timeout | null = null;
let ultimo: string | null = null;

// O espaço livre muda o tempo todo; não conta como mudança de status.
function assinatura(status: StatusSistema): string {
  return JSON.stringify({ ...status, workspace: { ...status.workspace, espacoLivreBytes: null } });
}

export function iniciarMonitorSistema(
  intervaloMs = 15000,
  obterStatus: () => Promise<StatusSistema> = obterStatusSistema,
): void {
  pararMonitorSistema();
  let verificando = false;
  const verificar = async () => {
    if (verificando) return;
    verificando = true;
    try {
      const status = await obterStatus();
      const atual = assinatura(status);
      if (ultimo !== null && atual !== ultimo) emitirEvento({ tipo: "sistema", dados: status });
      ultimo = atual;
    } catch (erro) {
      // Disco saindo no meio da consulta, por exemplo: tenta de novo na próxima volta.
      console.error("Monitor do sistema:", (erro as Error).message);
    } finally {
      verificando = false;
    }
  };
  void verificar();
  temporizador = setInterval(verificar, intervaloMs);
  temporizador.unref();
}

export function pararMonitorSistema(): void {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
  ultimo = null;
}
