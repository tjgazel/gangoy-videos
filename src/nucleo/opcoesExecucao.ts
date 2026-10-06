import { resolve } from "node:path";
import { lerConfiguracaoApp } from "./configuracaoApp.js";

// O que muda entre execução normal e testes: pasta de dados da máquina, Ollama e porta.
export interface OpcoesExecucao {
  pastaDados: string;
  urlOllama: string;
  porta: number;
  // npm run dev: a interface vem do Vite (porta 5173), que também precisa ser aceito.
  desenvolvimento: boolean;
}

let atuais: OpcoesExecucao | null = null;

function padroes(): OpcoesExecucao {
  const config = lerConfiguracaoApp();
  return { pastaDados: resolve("dados"), urlOllama: config.ollama.url, porta: config.porta, desenvolvimento: false };
}

export function definirOpcoesExecucao(parcial: Partial<OpcoesExecucao>): void {
  atuais = { ...padroes(), ...parcial };
}

export function obterOpcoesExecucao(): OpcoesExecucao {
  if (!atuais) atuais = padroes();
  return atuais;
}
