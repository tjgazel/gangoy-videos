import { resolve } from "node:path";
import { lerConfiguracaoApp } from "./configuracaoApp.js";

// O que muda entre execução normal e testes: pasta de dados da máquina, Ollama e porta.
export interface OpcoesExecucao {
  pastaDados: string;
  urlOllama: string;
  porta: number;
}

let atuais: OpcoesExecucao | null = null;

function padroes(): OpcoesExecucao {
  const config = lerConfiguracaoApp();
  return { pastaDados: resolve("dados"), urlOllama: config.ollama.url, porta: config.porta };
}

export function definirOpcoesExecucao(parcial: Partial<OpcoesExecucao>): void {
  atuais = { ...padroes(), ...parcial };
}

export function obterOpcoesExecucao(): OpcoesExecucao {
  if (!atuais) atuais = padroes();
  return atuais;
}
