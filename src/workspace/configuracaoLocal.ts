import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";

// O que é só desta máquina (fica em dados/, fora do Git): onde está a workspace.
function caminhoArquivo(): string {
  return join(obterOpcoesExecucao().pastaDados, "configuracao-local.json");
}

export function lerConfiguracaoLocal(): { pastaWorkspace: string | null } {
  const caminho = caminhoArquivo();
  if (!existsSync(caminho)) return { pastaWorkspace: null };
  const dados = JSON.parse(readFileSync(caminho, "utf-8")) as { pastaWorkspace?: string };
  return { pastaWorkspace: dados.pastaWorkspace || null };
}

export function salvarConfiguracaoLocal(dados: { pastaWorkspace: string }): void {
  const caminho = caminhoArquivo();
  mkdirSync(obterOpcoesExecucao().pastaDados, { recursive: true });
  writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf-8");
}
