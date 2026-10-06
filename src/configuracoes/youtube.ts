import { z } from "zod";
import { obterBanco } from "../banco/banco.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { lerConfiguracao, salvarConfiguracao } from "./sistema.js";

// Client ID e Client Secret ficam no banco da workspace (fora do Git).
export const esquemaCredenciaisYoutube = z.object({
  clientId: z.string().trim().min(1, "Informe o Client ID do Google Cloud"),
  // Vazio significa "manter o segredo que já está salvo".
  clientSecret: z.string().trim().default(""),
});

export type CredenciaisYoutube = z.infer<typeof esquemaCredenciaisYoutube>;

export interface ResumoCredenciaisYoutube {
  clientId: string;
  clientSecretSalvo: boolean;
  conectado: boolean;
}

// Nunca devolve o client_secret; a tela só precisa saber se ele existe.
export function lerResumoCredenciaisYoutube(): ResumoCredenciaisYoutube {
  const contas = obterBanco().prepare("SELECT COUNT(*) AS total FROM contas_youtube").get() as {
    total: number;
  };
  return {
    clientId: lerConfiguracao("youtube_client_id") ?? "",
    clientSecretSalvo: Boolean(lerConfiguracao("youtube_client_secret")),
    conectado: contas.total > 0,
  };
}

export function salvarCredenciaisYoutube(dados: CredenciaisYoutube): ResumoCredenciaisYoutube {
  const segredo = dados.clientSecret || lerConfiguracao("youtube_client_secret") || "";
  if (!segredo) throw new ErroAplicacao("Informe o Client Secret do Google Cloud");
  salvarConfiguracao("youtube_client_id", dados.clientId);
  salvarConfiguracao("youtube_client_secret", segredo);
  return lerResumoCredenciaisYoutube();
}

// Uso interno do servidor (fluxo OAuth). Não expor em rota.
export function lerCredenciaisCompletasYoutube(): { clientId: string; clientSecret: string } | null {
  const clientId = lerConfiguracao("youtube_client_id");
  const clientSecret = lerConfiguracao("youtube_client_secret");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
