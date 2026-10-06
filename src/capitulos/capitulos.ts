import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { obterBanco } from "../banco/banco.js";
import { pastaRoteiro } from "../workspace/caminhos.js";

export type StatusCapitulo = "planejado" | "roteiro_gerado" | "aprovado";

export interface Capitulo {
  id: number;
  projetoId: number;
  numero: number;
  titulo: string;
  status: StatusCapitulo;
  duracaoAlvoMinutos: number;
}

interface LinhaCapitulo {
  id: number;
  projeto_id: number;
  numero: number;
  titulo: string;
  status: StatusCapitulo;
  duracao_alvo_minutos: number;
}

function converterLinha(linha: LinhaCapitulo): Capitulo {
  return {
    id: linha.id,
    projetoId: linha.projeto_id,
    numero: linha.numero,
    titulo: linha.titulo,
    status: linha.status,
    duracaoAlvoMinutos: linha.duracao_alvo_minutos,
  };
}

export function listarCapitulos(projetoId: number): Capitulo[] {
  const linhas = obterBanco()
    .prepare("SELECT * FROM capitulos WHERE projeto_id = ? ORDER BY numero")
    .all(projetoId) as unknown as LinhaCapitulo[];
  return linhas.map(converterLinha);
}

export function buscarCapitulo(projetoId: number, numero: number): Capitulo | null {
  const linha = obterBanco()
    .prepare("SELECT * FROM capitulos WHERE projeto_id = ? AND numero = ?")
    .get(projetoId, numero) as unknown as LinhaCapitulo | undefined;
  return linha ? converterLinha(linha) : null;
}

export function criarCapitulo(
  projetoId: number,
  numero: number,
  titulo: string,
  duracaoAlvoMinutos: number,
): Capitulo {
  obterBanco()
    .prepare(`
      INSERT INTO capitulos (projeto_id, numero, titulo, status, duracao_alvo_minutos, criado_em)
      VALUES (?, ?, ?, 'planejado', ?, ?)
    `)
    .run(projetoId, numero, titulo, duracaoAlvoMinutos, new Date().toISOString());
  return buscarCapitulo(projetoId, numero) as Capitulo;
}

export function atualizarStatusCapitulo(projetoId: number, numero: number, status: StatusCapitulo): void {
  obterBanco()
    .prepare("UPDATE capitulos SET status = ? WHERE projeto_id = ? AND numero = ?")
    .run(status, projetoId, numero);
}

// ---- Versões do roteiro (arquivos em capitulos/capitulo-NNN/roteiro/) ----

export interface VersaoRoteiro {
  versao: number;
  criadoEm: string;
  instrucao: string;
  roteiro: {
    titulo: string;
    cenas: { narracao: string; personagensPresentes: string[]; descricaoVisual: string }[];
  };
  palavras: number;
  minutosEstimados: number;
  // Versões geradas antes da fila de tarefas não têm estes campos.
  modelo?: string;
  duracaoGeracaoSegundos?: number;
  contexto?: {
    numCtx: number;
    tokensPrompt: number;
    tokensResposta: number;
    possivelCorte: boolean;
    percentualCpu: number | null;
  };
}

function pastaVersoes(slug: string, numero: number): string {
  return pastaRoteiro(slug, numero);
}

export function listarNumerosVersoes(slug: string, numero: number): number[] {
  const pasta = pastaVersoes(slug, numero);
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .map((nome) => /^roteiro_v(\d+)\.json$/.exec(nome))
    .filter((encontrado): encontrado is RegExpExecArray => encontrado !== null)
    .map((encontrado) => Number(encontrado[1]))
    .sort((a, b) => a - b);
}

export function lerVersaoRoteiro(slug: string, numero: number, versao: number): VersaoRoteiro | null {
  const caminho = join(pastaVersoes(slug, numero), `roteiro_v${versao}.json`);
  if (!existsSync(caminho)) return null;
  return JSON.parse(readFileSync(caminho, "utf-8")) as VersaoRoteiro;
}

export function lerUltimaVersaoRoteiro(slug: string, numero: number): VersaoRoteiro | null {
  const versoes = listarNumerosVersoes(slug, numero);
  const ultima = versoes[versoes.length - 1];
  return ultima ? lerVersaoRoteiro(slug, numero, ultima) : null;
}

// Salva a próxima versão; nunca sobrescreve a anterior.
export function salvarNovaVersaoRoteiro(
  slug: string,
  numero: number,
  dados: Omit<VersaoRoteiro, "versao" | "criadoEm">,
): VersaoRoteiro {
  const pasta = pastaVersoes(slug, numero);
  mkdirSync(pasta, { recursive: true });
  const versoes = listarNumerosVersoes(slug, numero);
  const proxima = (versoes[versoes.length - 1] ?? 0) + 1;
  const versao: VersaoRoteiro = { versao: proxima, criadoEm: new Date().toISOString(), ...dados };
  writeFileSync(join(pasta, `roteiro_v${proxima}.json`), JSON.stringify(versao, null, 2), "utf-8");
  return versao;
}
