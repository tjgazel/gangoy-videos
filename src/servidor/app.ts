import { formatarProblema } from "../nucleo/mensagensValidacao.js";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { lerConfiguracaoApp } from "../nucleo/configuracaoApp.js";
import { definirOpcoesExecucao, obterOpcoesExecucao, type OpcoesExecucao } from "../nucleo/opcoesExecucao.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { bancoAberto, fecharBanco } from "../banco/banco.js";
import { iniciarFila, pararFila, prepararFilaAoIniciar, registrarExecutor } from "../tarefas/fila.js";
import { moverWorkspace } from "../workspace/mover.js";
import { registrarExecutoresHistoria } from "../tarefas/executoresHistoria.js";
import { iniciarMonitorSistema, pararMonitorSistema } from "../sistema/monitor.js";
import {
  abrirWorkspaceConfigurada,
  definirAoReabrir,
  definirConversaoAoCriar,
  obterPastaWorkspace,
} from "../workspace/workspace.js";
import { converterDadosAntigos, existemDadosAntigos } from "../workspace/conversao.js";
import {
  esquemaCredenciaisYoutube,
  lerResumoCredenciaisYoutube,
  salvarCredenciaisYoutube,
} from "../configuracoes/youtube.js";
import { registrarRotasProjetos } from "./rotasProjetos.js";
import { registrarRotasWorkspace } from "./rotasWorkspace.js";
import { registrarRotasTarefas } from "./rotasTarefas.js";
import { registrarRotasConfiguracoes } from "./rotasConfiguracoes.js";
import { registrarRotasHistoria } from "./rotasHistoria.js";
import { registrarRotasYoutube } from "./rotasYoutube.js";

// Porta do Vite em desenvolvimento: o proxy repassa o Host original.
const PORTA_VITE = 5173;

// /api/eventos não usa o banco: precisa funcionar antes da workspace existir e com o disco ausente.
const ROTAS_SEM_WORKSPACE = ["/api/sistema/", "/api/workspace", "/api/configuracoes/app", "/api/eventos"];

function hostPermitido(host: string | undefined, porta: number): boolean {
  if (!host) return false;
  const permitidos = [porta, PORTA_VITE].flatMap((p) => [`localhost:${p}`, `127.0.0.1:${p}`]);
  return permitidos.includes(host.toLowerCase());
}

// Navegador manda Origin em POST de outro site (até sem corpo, em modo no-cors): só aceita as nossas.
function origemPermitida(origem: string | undefined, porta: number): boolean {
  if (!origem) return true;
  const permitidas = [porta, PORTA_VITE].flatMap((p) => [`http://localhost:${p}`, `http://127.0.0.1:${p}`]);
  return permitidas.includes(origem.toLowerCase());
}

// Monta o servidor sem abrir a porta: usado pelo servidor real e pelos testes.
export async function criarApp(opcoes: Partial<OpcoesExecucao> = {}): Promise<FastifyInstance> {
  definirOpcoesExecucao(opcoes);
  const { porta } = obterOpcoesExecucao();

  // Nos testes (node:test) o log fica desligado para não poluir a saída.
  const app = Fastify({ logger: !process.env.NODE_TEST_CONTEXT });

  // Aceita JSON vazio: os botões de gerar e propor chamam POST sem corpo.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_requisicao, corpo, pronto) => {
    try {
      pronto(null, corpo ? JSON.parse(corpo as string) : {});
    } catch (erro) {
      pronto(new ErroAplicacao("Corpo da requisição não é JSON válido"), undefined);
    }
  });

  // Protege contra DNS rebinding: a API lista pastas e move arquivos.
  app.addHook("onRequest", async (requisicao, resposta) => {
    if (!hostPermitido(requisicao.headers.host, porta) || !origemPermitida(requisicao.headers.origin, porta)) {
      return resposta.code(403).send({ erro: "Acesso recusado" });
    }
  });

  app.setErrorHandler((erro, requisicao, resposta) => {
    if (erro instanceof ErroAplicacao) return resposta.code(erro.status).send({ erro: erro.message });
    if (erro instanceof z.ZodError) {
      const problema = erro.issues[0];
      return resposta.code(400).send({ erro: problema ? formatarProblema(problema) : "Dados inválidos" });
    }
    const status = (erro as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return resposta.code(status).send({ erro: (erro as Error).message });
    }
    requisicao.log.error(erro);
    return resposta.code(500).send({ erro: "Erro inesperado. Veja o log do servidor." });
  });

  abrirWorkspaceConfigurada();
  // Ao criar a primeira workspace, traz os projetos do formato antigo (dados/app.db e dados/projetos/).
  definirConversaoAoCriar((pastaWorkspace) => {
    const { pastaDados } = obterOpcoesExecucao();
    if (existemDadosAntigos(pastaDados)) converterDadosAntigos(pastaDados, pastaWorkspace);
  });
  registrarExecutor("mover_workspace", (tarefa, contexto) => moverWorkspace(String(tarefa.parametros.destino), contexto));
  registrarExecutoresHistoria();
  definirAoReabrir(() => {
    prepararFilaAoIniciar();
    iniciarFila();
  });
  if (bancoAberto()) prepararFilaAoIniciar();
  iniciarFila();
  iniciarMonitorSistema();
  app.addHook("onClose", async () => {
    pararMonitorSistema();
    await pararFila();
    fecharBanco();
  });

  // Rotas de dados exigem a workspace disponível (503 com a explicação, se não estiver).
  app.addHook("onRequest", async (requisicao) => {
    const url = requisicao.url;
    if (!url.startsWith("/api/") || ROTAS_SEM_WORKSPACE.some((prefixo) => url.startsWith(prefixo))) return;
    obterPastaWorkspace();
  });

  // Interface Vue já construída (npm run construir:interface). Em desenvolvimento quem serve é o Vite.
  const pastaInterface = resolve("interface", "dist");
  if (existsSync(pastaInterface)) {
    await app.register(fastifyStatic, { root: pastaInterface, prefix: "/" });
    // Rotas da interface (ex.: /producao) devolvem o index.html; o Vue Router decide a tela.
    app.setNotFoundHandler((requisicao, resposta) => {
      if (requisicao.method === "GET" && !requisicao.url.startsWith("/api/")) return resposta.sendFile("index.html");
      return resposta.code(404).send({ erro: "Rota não encontrada" });
    });
  }

  const configuracao = lerConfiguracaoApp();
  app.get("/api/configuracoes/app", async () => ({
    limiteDuracaoMinutos: configuracao.youtube.limiteDuracaoMinutos,
    limiteDuracaoObservacao: configuracao.youtube.limiteDuracaoObservacao,
    modeloPadrao: configuracao.ollama.modeloPadrao,
    modeloLeve: configuracao.ollama.modeloLeve,
    privacidadesPermitidas: configuracao.youtube.privacidadesPermitidas,
    privacidadePadrao: configuracao.youtube.privacidadePadrao,
  }));
  app.get("/api/configuracoes/youtube", async () => lerResumoCredenciaisYoutube());
  app.put("/api/configuracoes/youtube", async (requisicao) =>
    salvarCredenciaisYoutube(esquemaCredenciaisYoutube.parse(requisicao.body)),
  );

  registrarRotasWorkspace(app);
  registrarRotasTarefas(app);
  registrarRotasConfiguracoes(app);
  registrarRotasProjetos(app);
  registrarRotasHistoria(app);
  registrarRotasYoutube(app);

  return app;
}
