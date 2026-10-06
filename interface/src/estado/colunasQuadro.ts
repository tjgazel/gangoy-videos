import type { Capitulo, Tarefa } from "../api/tipos";

// Colunas do quadro de produção. Os subprojetos 2 e 3 acrescentam Mídia, Revisão do vídeo e Publicado.
export type IdColuna = "planejado" | "roteiro" | "roteiro_aprovado";

export const COLUNAS: { id: IdColuna; titulo: string }[] = [
  { id: "planejado", titulo: "Planejado" },
  { id: "roteiro", titulo: "Roteiro" },
  { id: "roteiro_aprovado", titulo: "Roteiro aprovado" },
];

// Capítulo planejado com geração em andamento já aparece em Roteiro.
export function colunaDoCapitulo(capitulo: Capitulo, tarefaAtiva: Tarefa | null): IdColuna {
  if (capitulo.status === "aprovado") return "roteiro_aprovado";
  if (capitulo.status === "roteiro_gerado") return "roteiro";
  if (tarefaAtiva && (tarefaAtiva.tipo === "gerar_roteiro" || tarefaAtiva.tipo === "refazer_roteiro")) return "roteiro";
  return "planejado";
}
