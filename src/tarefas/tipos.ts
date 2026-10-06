export type TipoTarefa =
  | "propor_planejamento"
  | "gerar_roteiro"
  | "refazer_roteiro"
  | "verificar_continuidade"
  | "propor_atualizacao_dossie"
  | "mover_workspace";

export type StatusTarefa = "na_fila" | "executando" | "concluida" | "falhou" | "cancelada";

export interface Tarefa {
  id: number;
  tipo: TipoTarefa;
  chave: string;
  projetoId: number | null;
  capituloNumero: number | null;
  parametros: Record<string, unknown>;
  status: StatusTarefa;
  progresso: number;
  mensagem: string;
  resultado: unknown | null;
  erro: string | null;
  criadaEm: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
}

export interface ContextoExecucao {
  relatarProgresso(porcentagem: number, mensagem: string): void;
  sinal: AbortSignal;
}

export type Executor = (tarefa: Tarefa, contexto: ContextoExecucao) => Promise<unknown>;
