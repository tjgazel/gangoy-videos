import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";
import { estadoWorkspace, type EstadoWorkspace } from "../workspace/workspace.js";
import { existemDadosAntigos } from "../workspace/conversao.js";

export interface StatusSistema {
  workspace: EstadoWorkspace;
  ollama: { online: boolean; versao: string | null; url: string };
  // Há dados do formato antigo em dados/ que serão trazidos ao criar a workspace.
  existemDadosAntigos: boolean;
}

async function consultarOllama(url: string): Promise<{ online: boolean; versao: string | null }> {
  try {
    const resposta = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(3000) });
    if (!resposta.ok) return { online: false, versao: null };
    const dados = (await resposta.json()) as { version?: string };
    return { online: true, versao: dados.version ?? null };
  } catch {
    return { online: false, versao: null };
  }
}

export async function obterStatusSistema(): Promise<StatusSistema> {
  const { urlOllama: url, pastaDados } = obterOpcoesExecucao();
  return {
    workspace: estadoWorkspace(),
    ollama: { ...(await consultarOllama(url)), url },
    existemDadosAntigos: existemDadosAntigos(pastaDados),
  };
}
