import type { StatusSistema } from "../sistema/status.js";
import type { Tarefa } from "./tipos.js";

// Eventos enviados à interface pelo canal SSE (/api/eventos).
export type Evento = { tipo: "tarefa"; dados: Tarefa } | { tipo: "sistema"; dados: StatusSistema };

const ouvintes = new Set<(evento: Evento) => void>();

export function emitirEvento(evento: Evento): void {
  for (const ouvinte of ouvintes) ouvinte(evento);
}

export function assinarEventos(ouvinte: (evento: Evento) => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}
