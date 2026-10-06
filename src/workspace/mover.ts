import { existsSync, renameSync, statSync, statfsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, relative, resolve, isAbsolute } from "node:path";
import { fecharBanco } from "../banco/banco.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import type { ContextoExecucao } from "../tarefas/tipos.js";
import { copiarConferindoAssincrono, medirPasta } from "./copiaConferida.js";
import {
  NOME_PASTA_WORKSPACE,
  apontarWorkspace,
  definirMovendo,
  ehWorkspace,
  obterPastaWorkspace,
} from "./workspace.js";

// Margem exigida no destino sobre o tamanho atual da workspace.
const MARGEM_ESPACO = 1.1;

export interface DependenciasMover {
  renomear?: typeof renameSync;
  copiar?: typeof copiarConferindoAssincrono;
  apagar?: (caminho: string) => Promise<void> | void;
  espacoLivre?: (caminho: string) => number;
}

function espacoLivrePadrao(caminho: string): number {
  const info = statfsSync(caminho);
  return Number(info.bavail) * Number(info.bsize);
}

function apagarPadrao(caminho: string): Promise<void> {
  return rm(caminho, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

// Confere o destino antes de mexer em qualquer coisa. Usado pela rota (antes de enfileirar) e pela tarefa.
export function validarDestinoMovimento(
  destino: string,
  dependencias: DependenciasMover = {},
): { atual: string; novo: string } {
  const atual = obterPastaWorkspace();
  if (!existsSync(destino) || !statSync(destino).isDirectory()) {
    throw new ErroAplicacao("A pasta de destino não existe", 400);
  }
  const novo = join(resolve(destino), NOME_PASTA_WORKSPACE);
  if (novo === atual) throw new ErroAplicacao("A workspace já está nesse local", 400);
  const dentro = relative(atual, novo);
  if (!dentro.startsWith("..") && !isAbsolute(dentro)) {
    throw new ErroAplicacao("O destino não pode ficar dentro da workspace atual", 400);
  }
  if (existsSync(novo)) {
    if (ehWorkspace(novo)) throw new ErroAplicacao("O destino já tem uma workspace", 409);
    throw new ErroAplicacao(`Já existe uma pasta ${NOME_PASTA_WORKSPACE} no destino`, 409);
  }
  const espacoLivre = dependencias.espacoLivre ?? espacoLivrePadrao;
  if (espacoLivre(destino) < medirPasta(atual).bytes * MARGEM_ESPACO) {
    throw new ErroAplicacao("Espaço livre insuficiente no destino", 409);
  }
  return { atual, novo };
}

// Ordem segura: copiar e conferir → passar a usar o destino → só então apagar a origem.
// Falha ao apagar a origem não desfaz nada: vira aviso para o usuário apagar à mão.
export async function moverWorkspace(
  destino: string,
  contexto: ContextoExecucao,
  dependencias: DependenciasMover = {},
): Promise<{ caminho: string; aviso?: string }> {
  const { atual, novo } = validarDestinoMovimento(destino, dependencias);
  const renomear = dependencias.renomear ?? renameSync;
  const copiar = dependencias.copiar ?? copiarConferindoAssincrono;
  const apagar = dependencias.apagar ?? apagarPadrao;

  contexto.relatarProgresso(5, "Preparando a mudança");
  definirMovendo(true);
  fecharBanco();
  let copiou = false;
  try {
    try {
      renomear(atual, novo);
    } catch (erro) {
      // Outro disco: o sistema não renomeia entre unidades; copia e confere arquivo por arquivo.
      if ((erro as { code?: string }).code !== "EXDEV") throw erro;
      try {
        await copiar(atual, novo, {
          sinal: contexto.sinal,
          aoProgresso: (copiados, total) =>
            contexto.relatarProgresso(10 + (copiados / total) * 80, `Copiando arquivos (${copiados} de ${total})`),
        });
      } catch (falha) {
        await rm(novo, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
        throw falha;
      }
      copiou = true;
    }
  } catch (erro) {
    definirMovendo(false);
    apontarWorkspace(atual);
    throw erro;
  }

  // Ponto sem volta: a workspace passa a ser a do destino.
  definirMovendo(false);
  apontarWorkspace(novo);

  if (!copiou) return { caminho: novo };
  contexto.relatarProgresso(95, "Apagando a origem");
  try {
    await apagar(atual);
    return { caminho: novo };
  } catch {
    return { caminho: novo, aviso: `Não foi possível apagar tudo em ${atual}; apague à mão.` };
  }
}
