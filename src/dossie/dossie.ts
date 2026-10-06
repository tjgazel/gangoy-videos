import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { caminhoDossie } from "../workspace/caminhos.js";

export const esquemaPersonagem = z.object({
  nome: z.string().min(1),
  papel: z.string().default(""),
  aparenciaFixa: z.string().min(5, "Descreva a aparência fixa do personagem"),
  tracos: z.array(z.string()).default([]),
  caminhoReferencia: z.string().default(""),
});

export const esquemaDossie = z.object({
  sinopse: z.string().default(""),
  mundo: z.string().default(""),
  personagens: z.array(esquemaPersonagem).default([]),
  linhaDoTempo: z.array(z.object({ capitulo: z.number().int(), evento: z.string() })).default([]),
  fatos: z.array(z.object({ capitulo: z.number().int(), descricao: z.string() })).default([]),
  fiosAbertos: z.array(z.string()).default([]),
  esbocosCapitulos: z
    .array(z.object({ numero: z.number().int(), titulo: z.string(), resumo: z.string() }))
    .default([]),
  resumosCapitulos: z.array(z.object({ numero: z.number().int(), resumo: z.string() })).default([]),
});

export type Personagem = z.infer<typeof esquemaPersonagem>;
export type Dossie = z.infer<typeof esquemaDossie>;

export function lerDossie(slug: string): Dossie | null {
  const caminho = caminhoDossie(slug);
  if (!existsSync(caminho)) return null;
  return esquemaDossie.parse(JSON.parse(readFileSync(caminho, "utf-8")));
}

export function salvarDossie(slug: string, dossie: Dossie): void {
  const caminho = caminhoDossie(slug);
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, JSON.stringify(dossie, null, 2), "utf-8");
}
