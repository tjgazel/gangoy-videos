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

// Estilo próprio, nas cores do tema escuro: a página não depende dos arquivos da interface.
const ESTILO_RETORNO = `
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f1218; color: #e6e9f0;
  font: 14px/1.5 "Segoe UI", system-ui, -apple-system, "Noto Sans", "Ubuntu", sans-serif; }
.cartao { max-width: 480px; margin: 24px; padding: 24px 28px; background: #1b2030; border: 1px solid #252b3c; border-radius: 10px; }
h1 { margin: 0 0 8px; font-size: 18px; }
.sucesso { color: #34d399; }
.erro { color: #f87171; }
a { color: #3b82f6; }`;

// Página exibida no navegador ao voltar do Google; retorna sozinha para a tela de Configurações.
function paginaRetorno(resposta: FastifyReply, sucesso: boolean, mensagem: string) {
  return resposta
    .code(sucesso ? 200 : 400)
    .type("text/html; charset=utf-8")
    .send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Gangoy Vídeos</title>
${sucesso ? '<meta http-equiv="refresh" content="3;url=/configuracoes">' : ""}
<style>${ESTILO_RETORNO}</style></head>
<body><main class="cartao">
<h1 class="${sucesso ? "sucesso" : "erro"}">${sucesso ? "Conta conectada" : "Não foi possível conectar"}</h1>
<p>${escaparHtml(mensagem)}</p>
<p><a href="/configuracoes">Voltar para Configurações</a></p>
</main></body></html>`);
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
