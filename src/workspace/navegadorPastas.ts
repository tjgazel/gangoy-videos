import { existsSync, mkdirSync, readdirSync, statSync, type Dirent } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { ErroAplicacao } from "../nucleo/erros.js";
import { validarNomeSimples } from "../nucleo/nomes.js";

// Navegador de pastas para escolher a workspace. Só lê; criar pasta exige ação explícita.

export interface Raiz {
  nome: string;
  caminho: string;
}

export interface ListagemPastas {
  caminho: string;
  pai: string | null;
  pastas: { nome: string; caminho: string }[];
}

const OCULTAS_DO_SISTEMA = new Set(["System Volume Information"]);

export function listarRaizes(plataforma: NodeJS.Platform = process.platform): Raiz[] {
  if (plataforma === "win32") {
    return Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}:\\`)
      .filter((unidade) => existsSync(unidade))
      .map((unidade) => ({ nome: unidade.slice(0, 2), caminho: unidade }));
  }
  return [
    { nome: "/", caminho: "/" },
    { nome: "Pasta pessoal", caminho: homedir() },
  ];
}

function lerPadrao(caminho: string): Dirent[] {
  return readdirSync(caminho, { withFileTypes: true });
}

export function listarPastas(caminho: string, ler: (caminho: string) => Dirent[] = lerPadrao): ListagemPastas {
  if (!isAbsolute(caminho)) throw new ErroAplicacao("Informe um caminho absoluto", 400);
  const atual = resolve(caminho);

  let entradas: Dirent[];
  try {
    entradas = ler(atual);
  } catch (erro) {
    const codigo = (erro as { code?: string }).code;
    if (codigo === "EACCES" || codigo === "EPERM") throw new ErroAplicacao("Sem permissão para abrir esta pasta", 403);
    if (codigo === "ENOENT" || codigo === "ENOTDIR") throw new ErroAplicacao("Pasta não encontrada", 404);
    throw erro;
  }

  const pastas = entradas
    .filter((entrada) => {
      try {
        if (entrada.isDirectory()) return true;
        // Links e junções (ex.: OneDrive): vale o destino; link quebrado lança e é pulado.
        return entrada.isSymbolicLink() && statSync(join(atual, entrada.name)).isDirectory();
      } catch {
        return false; // entrada que não dá para inspecionar é pulada
      }
    })
    .map((entrada) => entrada.name)
    .filter((nome) => !nome.startsWith(".") && !nome.startsWith("$") && !OCULTAS_DO_SISTEMA.has(nome))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
    .map((nome) => ({ nome, caminho: join(atual, nome) }));

  const pai = dirname(atual);
  return { caminho: atual, pai: pai === atual ? null : pai, pastas };
}

export function criarPasta(caminhoPai: string, nome: string): { caminho: string } {
  if (!isAbsolute(caminhoPai)) throw new ErroAplicacao("Informe um caminho absoluto", 400);
  const caminho = join(resolve(caminhoPai), validarNomeSimples(nome));
  if (existsSync(caminho)) throw new ErroAplicacao("Já existe uma pasta com esse nome", 409);
  try {
    mkdirSync(caminho);
  } catch (erro) {
    const codigo = (erro as { code?: string }).code;
    if (codigo === "EACCES" || codigo === "EPERM") throw new ErroAplicacao("Sem permissão para criar a pasta aqui", 403);
    if (codigo === "ENOENT") throw new ErroAplicacao("Pasta não encontrada", 404);
    throw erro;
  }
  return { caminho };
}
