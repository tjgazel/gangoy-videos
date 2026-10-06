import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const esquemaConfiguracaoApp = z.object({
  porta: z.number().int().positive(),
  ollama: z.object({
    url: z.string().url(),
    modeloPadrao: z.string(),
    modeloLeve: z.string(),
  }),
  youtube: z.object({
    limiteDuracaoMinutos: z.number().positive(),
    limiteDuracaoObservacao: z.string(),
    privacidadesPermitidas: z.array(z.enum(["private", "unlisted", "public"])),
    privacidadePadrao: z.enum(["private", "unlisted", "public"]),
  }),
  caminhos: z.object({
    ferramentas: z.string(),
  }),
});

export type ConfiguracaoApp = z.infer<typeof esquemaConfiguracaoApp>;

let cache: ConfiguracaoApp | null = null;

// Lê configuracao/app.json da raiz do projeto (uma vez por execução).
export function lerConfiguracaoApp(): ConfiguracaoApp {
  if (cache) return cache;
  const caminho = resolve("configuracao", "app.json");
  const conteudo = JSON.parse(readFileSync(caminho, "utf-8"));
  cache = esquemaConfiguracaoApp.parse(conteudo);
  return cache;
}
