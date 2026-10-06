// Cópias dos tipos do servidor (a interface não importa código de src/).

export interface Projeto {
  id: number;
  nome: string;
  slug: string;
  tematica: string;
  idCanal: string;
  idPlaylist: string;
  frequencia: string;
  duracaoPadraoMinutos: number;
  idioma: string;
  modeloOllama: string;
  criadoEm: string;
}

export type StatusCapitulo = "planejado" | "roteiro_gerado" | "aprovado";

export interface Capitulo {
  id: number;
  projetoId: number;
  numero: number;
  titulo: string;
  status: StatusCapitulo;
  duracaoAlvoMinutos: number;
}

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
  resultado: unknown;
  erro: string | null;
  criadaEm: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
}

export interface Cena {
  narracao: string;
  personagensPresentes: string[];
  descricaoVisual: string;
}

export interface ContextoVersao {
  numCtx: number;
  tokensPrompt: number;
  tokensResposta: number;
  possivelCorte: boolean;
  percentualCpu: number | null;
}

export interface VersaoRoteiro {
  versao: number;
  criadoEm: string;
  instrucao: string;
  roteiro: { titulo: string; cenas: Cena[] };
  palavras: number;
  minutosEstimados: number;
  modelo?: string;
  duracaoGeracaoSegundos?: number;
  contexto?: ContextoVersao;
}

export interface ResumoVersao {
  versao: number;
  criadoEm: string;
  instrucao: string;
  palavras: number;
  minutosEstimados: number;
  modelo: string | null;
  duracaoGeracaoSegundos: number | null;
  contexto: ContextoVersao | null;
}

export interface Personagem {
  nome: string;
  papel: string;
  aparenciaFixa: string;
  tracos: string[];
  caminhoReferencia: string;
}

export interface Dossie {
  sinopse: string;
  mundo: string;
  personagens: Personagem[];
  linhaDoTempo: { capitulo: number; evento: string }[];
  fatos: { capitulo: number; descricao: string }[];
  fiosAbertos: string[];
  esbocosCapitulos: { numero: number; titulo: string; resumo: string }[];
  resumosCapitulos: { numero: number; resumo: string }[];
}

export interface Planejamento {
  sinopse: string;
  mundo: string;
  personagens: Personagem[];
  esbocos: { titulo: string; resumo: string }[];
}

export interface Atualizacao {
  resumoCapitulo: string;
  novosPersonagens: Personagem[];
  novosFatos: string[];
  fiosAbertos: string[];
  fiosResolvidos: string[];
}

export interface EstadoWorkspace {
  configurada: boolean;
  disponivel: boolean;
  caminho: string | null;
  movendo: boolean;
  espacoLivreBytes: number | null;
}

export interface StatusSistema {
  workspace: EstadoWorkspace;
  ollama: { online: boolean; versao: string | null; url: string };
  existemDadosAntigos: boolean;
}

export interface ModeloOllama {
  nome: string;
  tamanhoBytes: number;
  parametros: string;
  quantizacao: string;
  contextoMaximo: number | null;
  capacidades: string[];
  percentualCpu: number | null;
}

export interface ItemRevisao {
  tipo: "roteiro_para_aprovar" | "proposta_dossie_pronta";
  projetoId: number;
  capituloNumero: number;
  titulo: string;
  desde: string;
  tarefaId: number | null;
}

export interface ConfiguracoesSistema {
  modeloPrincipal: string;
  modeloLeve: string;
  contextoTrabalho: number;
}
