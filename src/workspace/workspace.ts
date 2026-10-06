import { existsSync, mkdirSync, readdirSync, rmSync, statSync, statfsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { abrirBanco, bancoAberto, fecharBanco } from "../banco/banco.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { lerConfiguracaoLocal, salvarConfiguracaoLocal } from "./configuracaoLocal.js";

export const NOME_PASTA_WORKSPACE = "Gangoy-workspace";
export const ARQUIVO_MARCADOR = ".gangoy-workspace.json";
export const ARQUIVO_BANCO = "gangoy.db";

export interface EstadoWorkspace {
  configurada: boolean;
  disponivel: boolean;
  caminho: string | null;
  movendo: boolean;
  // Marcador presente, mas sem gangoy.db (apagado, ou backup copiado pela metade).
  semBanco: boolean;
  espacoLivreBytes: number | null;
}

let pastaAtual: string | null = null;
let movendo = false;
let conversaoAoCriar: ((pastaWorkspace: string) => void) | null = null;
let aoReabrir: (() => void) | null = null;

export function ehWorkspace(caminho: string): boolean {
  return existsSync(join(caminho, ARQUIVO_MARCADOR));
}

// Aceita a própria workspace ou a pasta onde ela foi criada.
export function localizarWorkspace(local: string): string | null {
  if (ehWorkspace(local)) return resolve(local);
  const filha = join(local, NOME_PASTA_WORKSPACE);
  return ehWorkspace(filha) ? resolve(filha) : null;
}

// Usado pela conversão dos dados antigos (roda depois do marcador e antes de abrir o banco).
export function definirConversaoAoCriar(funcao: (pastaWorkspace: string) => void): void {
  conversaoAoCriar = funcao;
}

// Chamado quando o disco volta e o banco é reaberto (a fila retoma).
export function definirAoReabrir(funcao: () => void): void {
  aoReabrir = funcao;
}

function temBanco(caminho: string): boolean {
  return existsSync(join(caminho, ARQUIVO_BANCO));
}

function mensagemSemBanco(caminho: string): string {
  return `A workspace em ${caminho} está sem o arquivo ${ARQUIVO_BANCO}. Restaure-o de um backup ou aponte outro local.`;
}

// abrirBanco cria o arquivo se ele não existir: só a criação da workspace pode fazer isso.
function abrir(caminho: string): void {
  abrirBanco(join(caminho, ARQUIVO_BANCO));
  pastaAtual = caminho;
  salvarConfiguracaoLocal({ pastaWorkspace: caminho });
}

export function criarOuReconhecerWorkspace(local: string): { caminho: string; criada: boolean } {
  if (!existsSync(local) || !statSync(local).isDirectory()) {
    throw new ErroAplicacao("A pasta escolhida não existe", 400);
  }
  const existente = localizarWorkspace(local);
  if (existente) {
    if (!temBanco(existente)) throw new ErroAplicacao(mensagemSemBanco(existente), 409);
    abrir(existente);
    return { caminho: existente, criada: false };
  }

  const caminho = resolve(local, NOME_PASTA_WORKSPACE);
  if (existsSync(caminho) && readdirSync(caminho).length > 0) {
    throw new ErroAplicacao(`Já existe uma pasta ${NOME_PASTA_WORKSPACE} que não é uma workspace`, 409);
  }

  mkdirSync(caminho, { recursive: true });
  writeFileSync(
    join(caminho, ARQUIVO_MARCADOR),
    JSON.stringify({ versao: 1, criadoEm: new Date().toISOString() }, null, 2),
    "utf-8",
  );
  try {
    conversaoAoCriar?.(caminho);
  } catch (erro) {
    rmSync(caminho, { recursive: true, force: true });
    throw erro;
  }
  abrir(caminho);
  return { caminho, criada: true };
}

export function apontarWorkspace(caminho: string): string {
  const encontrada = existsSync(caminho) ? localizarWorkspace(caminho) : null;
  if (!encontrada) throw new ErroAplicacao("Esta pasta não é uma workspace do Gangoy Vídeos", 400);
  if (!temBanco(encontrada)) throw new ErroAplicacao(mensagemSemBanco(encontrada), 409);
  abrir(encontrada);
  return encontrada;
}

// Ao iniciar o servidor: lê o caminho desta máquina e abre o banco se a workspace estiver lá.
export function abrirWorkspaceConfigurada(): void {
  fecharBanco();
  pastaAtual = lerConfiguracaoLocal().pastaWorkspace;
  movendo = false;
  if (pastaAtual && ehWorkspace(pastaAtual) && temBanco(pastaAtual)) abrirBanco(join(pastaAtual, ARQUIVO_BANCO));
}

// Caminho da workspace em uso; confere o marcador a cada chamada (disco externo pode sumir).
export function obterPastaWorkspace(): string {
  if (movendo) throw new ErroAplicacao("A workspace está sendo movida. Aguarde a conclusão.", 503);
  if (!pastaAtual) {
    throw new ErroAplicacao("Nenhuma workspace configurada. Escolha o local na tela de boas-vindas.", 503);
  }
  if (!ehWorkspace(pastaAtual)) throw new ErroAplicacao(`Workspace não encontrada em ${pastaAtual}`, 503);
  // O disco voltou depois de ter sumido: reabre o banco.
  if (!bancoAberto()) {
    if (!temBanco(pastaAtual)) throw new ErroAplicacao(mensagemSemBanco(pastaAtual), 503);
    abrirBanco(join(pastaAtual, ARQUIVO_BANCO));
    aoReabrir?.();
  }
  return pastaAtual;
}

export function definirMovendo(valor: boolean): void {
  movendo = valor;
}

export function estadoWorkspace(): EstadoWorkspace {
  const marcada = pastaAtual !== null && ehWorkspace(pastaAtual);
  const semBanco = marcada && !temBanco(pastaAtual as string);
  const disponivel = marcada && !semBanco;
  let espacoLivreBytes: number | null = null;
  if (disponivel) {
    try {
      const info = statfsSync(pastaAtual as string);
      espacoLivreBytes = Number(info.bavail) * Number(info.bsize);
    } catch {
      espacoLivreBytes = null; // disco saindo entre a conferência e a medição
    }
  }
  return { configurada: pastaAtual !== null, disponivel, caminho: pastaAtual, movendo, semBanco, espacoLivreBytes };
}
