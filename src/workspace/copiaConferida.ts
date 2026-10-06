import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { ErroAplicacao } from "../nucleo/erros.js";

// Lista os arquivos de uma pasta (recursivo) com o caminho relativo e o tamanho.
function listarArquivos(base: string): { relativo: string; bytes: number }[] {
  const resultado: { relativo: string; bytes: number }[] = [];
  const visitar = (pasta: string) => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      const caminho = join(pasta, entrada.name);
      if (entrada.isDirectory()) visitar(caminho);
      else if (entrada.isFile()) resultado.push({ relativo: relative(base, caminho), bytes: statSync(caminho).size });
    }
  };
  if (existsSync(base)) visitar(base);
  return resultado;
}

export function medirPasta(caminho: string): { arquivos: number; bytes: number } {
  const arquivos = listarArquivos(caminho);
  return { arquivos: arquivos.length, bytes: arquivos.reduce((total, arquivo) => total + arquivo.bytes, 0) };
}

// Copia a pasta inteira e confere arquivo por arquivo (existência e tamanho) antes de devolver.
export function copiarConferindo(
  origem: string,
  destino: string,
  aoProgresso?: (copiados: number, total: number) => void,
): { arquivos: number; bytes: number } {
  const arquivos = listarArquivos(origem);
  mkdirSync(destino, { recursive: true });
  arquivos.forEach((arquivo, indice) => {
    const alvo = join(destino, arquivo.relativo);
    mkdirSync(dirname(alvo), { recursive: true });
    copyFileSync(join(origem, arquivo.relativo), alvo);
    aoProgresso?.(indice + 1, arquivos.length);
  });

  for (const arquivo of arquivos) {
    const alvo = join(destino, arquivo.relativo);
    if (!existsSync(alvo) || statSync(alvo).size !== arquivo.bytes) {
      throw new ErroAplicacao(`A cópia não confere: ${arquivo.relativo}`, 500);
    }
  }
  return { arquivos: arquivos.length, bytes: arquivos.reduce((total, arquivo) => total + arquivo.bytes, 0) };
}

// Versão assíncrona (usada ao mover a workspace): devolve o controle ao servidor a cada arquivo,
// para o progresso sair ao vivo e o cancelamento funcionar no meio da cópia.
export async function copiarConferindoAssincrono(
  origem: string,
  destino: string,
  opcoes: { aoProgresso?: (copiados: number, total: number) => void; sinal?: AbortSignal } = {},
): Promise<{ arquivos: number; bytes: number }> {
  const arquivos = listarArquivos(origem);
  await mkdir(destino, { recursive: true });
  for (const [indice, arquivo] of arquivos.entries()) {
    opcoes.sinal?.throwIfAborted();
    const alvo = join(destino, arquivo.relativo);
    await mkdir(dirname(alvo), { recursive: true });
    await copyFile(join(origem, arquivo.relativo), alvo);
    opcoes.aoProgresso?.(indice + 1, arquivos.length);
  }
  opcoes.sinal?.throwIfAborted();
  for (const arquivo of arquivos) {
    const alvo = join(destino, arquivo.relativo);
    const tamanho = await stat(alvo).then((info) => info.size).catch(() => -1);
    if (tamanho !== arquivo.bytes) throw new ErroAplicacao(`A cópia não confere: ${arquivo.relativo}`, 500);
  }
  return { arquivos: arquivos.length, bytes: arquivos.reduce((total, arquivo) => total + arquivo.bytes, 0) };
}
