import { join } from "node:path";
import { garantirDentroDe } from "../nucleo/nomes.js";
import { obterPastaWorkspace } from "./workspace.js";

// Todos os caminhos de arquivo de projeto passam por aqui e ficam dentro da workspace.
function dentroDaWorkspace(...partes: string[]): string {
  const workspace = obterPastaWorkspace();
  return garantirDentroDe(workspace, join(workspace, ...partes));
}

// <workspace>/<slug>
export function pastaProjeto(slug: string): string {
  return dentroDaWorkspace(slug);
}

export function caminhoDossie(slug: string): string {
  return dentroDaWorkspace(slug, "dossie.json");
}

// <workspace>/<slug>/capitulos/capitulo-001
export function pastaCapitulo(slug: string, numero: number): string {
  return dentroDaWorkspace(slug, "capitulos", `capitulo-${String(numero).padStart(3, "0")}`);
}

export function pastaRoteiro(slug: string, numero: number): string {
  return join(pastaCapitulo(slug, numero), "roteiro");
}

export function pastaLixeira(): string {
  return dentroDaWorkspace(".lixeira");
}
