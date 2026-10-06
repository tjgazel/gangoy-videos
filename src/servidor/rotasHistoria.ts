import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ErroAplicacao } from "../nucleo/erros.js";
import { lerDossie, salvarDossie, esquemaDossie } from "../dossie/dossie.js";
import { buscarProjetoPorId, type Projeto } from "../projetos/projetos.js";
import {
  listarCapitulos,
  listarNumerosVersoes,
  lerUltimaVersaoRoteiro,
  lerVersaoRoteiro,
} from "../capitulos/capitulos.js";
import { confirmarPlanejamento, esquemaPlanejamento, validarPedidoPlanejamento } from "../planejamento/planejamento.js";
import { validarPedidoRoteiro } from "../roteiro/roteiro.js";
import { validarPedidoComRoteiro } from "../continuidade/continuidade.js";
import { aplicarAtualizacaoDossie, esquemaAtualizacao } from "../dossie/atualizacao.js";
import { criarTarefa } from "../tarefas/fila.js";
import { listarPendencias } from "../revisao/revisao.js";

const esquemaProjetoId = z.object({ id: z.coerce.number().int().positive() });
const esquemaCapitulo = z.object({
  id: z.coerce.number().int().positive(),
  numero: z.coerce.number().int().positive(),
});

const esquemaModelo = z.object({ modelo: z.string().trim().optional() });

type ParamsProjeto = { Params: { id: string } };
type ParamsCapitulo = { Params: { id: string; numero: string } };

function exigirProjeto(id: number): Projeto {
  const projeto = buscarProjetoPorId(id);
  if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);
  return projeto;
}

export function registrarRotasHistoria(app: FastifyInstance): void {
  // ---- Revisão: o que espera o usuário ----

  app.get<{ Querystring: { projetoId?: string } }>("/api/revisao", async (requisicao) => {
    const { projetoId } = requisicao.query;
    return { itens: listarPendencias(projetoId ? z.coerce.number().int().positive().parse(projetoId) : undefined) };
  });

  // ---- Dossiê ----

  app.get<ParamsProjeto>("/api/projetos/:id/dossie", async (requisicao) => {
    const projeto = exigirProjeto(esquemaProjetoId.parse(requisicao.params).id);
    const dossie = lerDossie(projeto.slug);
    if (!dossie) throw new ErroAplicacao("Este projeto ainda não tem dossiê.", 404);
    return dossie;
  });

  app.put<ParamsProjeto>("/api/projetos/:id/dossie", async (requisicao) => {
    const projeto = exigirProjeto(esquemaProjetoId.parse(requisicao.params).id);
    const dossie = esquemaDossie.parse(requisicao.body);
    salvarDossie(projeto.slug, dossie);
    return dossie;
  });

  // ---- Planejamento ----

  // Trabalhos lentos (Ollama) viram tarefas na fila: a resposta é 202 com o id da tarefa.
  app.post<ParamsProjeto>("/api/projetos/:id/planejamento", async (requisicao, resposta) => {
    const { id } = esquemaProjetoId.parse(requisicao.params);
    const corpo = z.object({ enredo: z.string(), modelo: z.string().trim().optional() }).parse(requisicao.body);
    validarPedidoPlanejamento(id, corpo.enredo);
    const tarefa = criarTarefa({ tipo: "propor_planejamento", projetoId: id, capituloNumero: null, parametros: corpo });
    return resposta.code(202).send({ tarefaId: tarefa.id });
  });

  app.post<ParamsProjeto>("/api/projetos/:id/planejamento/confirmar", async (requisicao) =>
    confirmarPlanejamento(
      esquemaProjetoId.parse(requisicao.params).id,
      esquemaPlanejamento.parse(requisicao.body),
    ),
  );

  // ---- Capítulos e roteiro ----

  app.get<ParamsProjeto>("/api/projetos/:id/capitulos", async (requisicao) =>
    listarCapitulos(esquemaProjetoId.parse(requisicao.params).id),
  );

  app.get<ParamsCapitulo>("/api/projetos/:id/capitulos/:numero/roteiro", async (requisicao) => {
    const { id, numero } = esquemaCapitulo.parse(requisicao.params);
    const projeto = exigirProjeto(id);
    const versao = lerUltimaVersaoRoteiro(projeto.slug, numero);
    if (!versao) throw new ErroAplicacao("Este capítulo ainda não tem roteiro.", 404);
    return versao;
  });

  app.get<ParamsCapitulo>("/api/projetos/:id/capitulos/:numero/versoes", async (requisicao) => {
    const { id, numero } = esquemaCapitulo.parse(requisicao.params);
    const projeto = exigirProjeto(id);
    return listarNumerosVersoes(projeto.slug, numero).map((versao) => {
      const dados = lerVersaoRoteiro(projeto.slug, numero, versao);
      return {
        versao,
        criadoEm: dados?.criadoEm,
        instrucao: dados?.instrucao,
        palavras: dados?.palavras,
        minutosEstimados: dados?.minutosEstimados,
        modelo: dados?.modelo ?? null,
        duracaoGeracaoSegundos: dados?.duracaoGeracaoSegundos ?? null,
        contexto: dados?.contexto ?? null,
      };
    });
  });

  app.get<{ Params: { id: string; numero: string; versao: string } }>(
    "/api/projetos/:id/capitulos/:numero/versoes/:versao",
    async (requisicao) => {
      const { id, numero } = esquemaCapitulo.parse(requisicao.params);
      const versao = z.coerce.number().int().positive().parse(requisicao.params.versao);
      const dados = lerVersaoRoteiro(exigirProjeto(id).slug, numero, versao);
      if (!dados) throw new ErroAplicacao(`Versão ${versao} não encontrada`, 404);
      return dados;
    },
  );

  app.post<ParamsCapitulo>("/api/projetos/:id/capitulos/:numero/roteiro", async (requisicao, resposta) => {
    const { id, numero } = esquemaCapitulo.parse(requisicao.params);
    const corpo = esquemaModelo.parse(requisicao.body ?? {});
    validarPedidoRoteiro(id, numero);
    const tarefa = criarTarefa({ tipo: "gerar_roteiro", projetoId: id, capituloNumero: numero, parametros: corpo });
    return resposta.code(202).send({ tarefaId: tarefa.id });
  });

  app.post<ParamsCapitulo>("/api/projetos/:id/capitulos/:numero/refazer", async (requisicao, resposta) => {
    const { id, numero } = esquemaCapitulo.parse(requisicao.params);
    const corpo = z.object({ instrucao: z.string(), modelo: z.string().trim().optional() }).parse(requisicao.body);
    validarPedidoRoteiro(id, numero, corpo.instrucao);
    const tarefa = criarTarefa({ tipo: "refazer_roteiro", projetoId: id, capituloNumero: numero, parametros: corpo });
    return resposta.code(202).send({ tarefaId: tarefa.id });
  });

  app.post<ParamsCapitulo>("/api/projetos/:id/capitulos/:numero/continuidade", async (requisicao, resposta) => {
    const { id, numero } = esquemaCapitulo.parse(requisicao.params);
    const corpo = esquemaModelo.parse(requisicao.body ?? {});
    validarPedidoComRoteiro(id, numero);
    const tarefa = criarTarefa({ tipo: "verificar_continuidade", projetoId: id, capituloNumero: numero, parametros: corpo });
    return resposta.code(202).send({ tarefaId: tarefa.id });
  });

  // Gera a proposta de atualização do dossiê; o usuário revisa antes de aprovar.
  app.post<ParamsCapitulo>("/api/projetos/:id/capitulos/:numero/proposta-dossie", async (requisicao, resposta) => {
    const { id, numero } = esquemaCapitulo.parse(requisicao.params);
    validarPedidoComRoteiro(id, numero);
    const tarefa = criarTarefa({ tipo: "propor_atualizacao_dossie", projetoId: id, capituloNumero: numero });
    return resposta.code(202).send({ tarefaId: tarefa.id });
  });

  app.post<ParamsCapitulo>("/api/projetos/:id/capitulos/:numero/aprovar", async (requisicao) => {
    const { id, numero } = esquemaCapitulo.parse(requisicao.params);
    return aplicarAtualizacaoDossie(id, numero, esquemaAtualizacao.parse(requisicao.body));
  });
}
