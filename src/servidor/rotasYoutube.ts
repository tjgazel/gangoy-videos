import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { ErroAplicacao } from "../nucleo/erros.js";
import {
  concluirConexaoYoutube,
  desconectarCanalYoutube,
  iniciarConexaoYoutube,
  listarContasYoutube,
  uriRetornoOAuth,
} from "../youtube/oauth.js";

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Página exibida no navegador ao voltar do Google; retorna sozinha para a aba Configurações.
function paginaRetorno(resposta: FastifyReply, sucesso: boolean, mensagem: string) {
  const cor = sucesso ? "#1e7a46" : "#c0392b";
  return resposta
    .code(sucesso ? 200 : 400)
    .type("text/html; charset=utf-8")
    .send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Gangoy Vídeos</title>
${sucesso ? '<meta http-equiv="refresh" content="3;url=/#configuracoes">' : ""}
<link rel="stylesheet" href="/estilo.css"></head>
<body><main><div class="cartao">
<h2 style="color:${cor}">${sucesso ? "Conta conectada" : "Não foi possível conectar"}</h2>
<p>${escaparHtml(mensagem)}</p>
<p><a href="/#configuracoes">Voltar para Configurações</a></p>
</div></main></body></html>`);
}

export function registrarRotasYoutube(app: FastifyInstance): void {
  app.get("/api/youtube/contas", async () => ({
    uriRetorno: uriRetornoOAuth(),
    contas: listarContasYoutube(),
  }));

  // A interface pede a URL e redireciona o navegador para o Google.
  app.post("/api/youtube/oauth/iniciar", async () => ({ url: iniciarConexaoYoutube() }));

  app.get<{ Querystring: Record<string, string | undefined> }>(
    "/api/youtube/oauth/retorno",
    async (requisicao, resposta) => {
      const { code, state, error } = requisicao.query;
      if (error) {
        const motivo = error === "access_denied" ? "Você cancelou a autorização no Google." : `O Google respondeu: ${error}`;
        return paginaRetorno(resposta, false, motivo);
      }
      if (!code || !state) return paginaRetorno(resposta, false, "Retorno do Google sem código de autorização.");

      try {
        const canais = await concluirConexaoYoutube(code, state);
        const nomes = canais.map((canal) => `${canal.tituloCanal} (${canal.idCanal})`).join(", ");
        return paginaRetorno(resposta, true, `Canal conectado: ${nomes}.`);
      } catch (erro) {
        if (erro instanceof ErroAplicacao) return paginaRetorno(resposta, false, erro.message);
        requisicao.log.error(erro);
        return paginaRetorno(resposta, false, "Erro inesperado ao falar com o Google. Veja o log do servidor.");
      }
    },
  );

  app.delete<{ Params: { idCanal: string } }>("/api/youtube/contas/:idCanal", async (requisicao) =>
    desconectarCanalYoutube(z.string().min(1).parse(requisicao.params.idCanal)),
  );
}
