import type { FastifyInstance } from "fastify";
import {
  buscarProjetoPorId,
  criarProjeto,
  editarProjeto,
  esquemaEdicaoProjeto,
  esquemaNovoProjeto,
  excluirProjeto,
  listarProjetos,
} from "../projetos/projetos.js";
import { ErroAplicacao } from "../nucleo/erros.js";

export function registrarRotasProjetos(app: FastifyInstance): void {
  app.get("/api/projetos", async () => listarProjetos());

  app.get<{ Params: { id: string } }>("/api/projetos/:id", async (requisicao) => {
    const projeto = buscarProjetoPorId(Number(requisicao.params.id));
    if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);
    return projeto;
  });

  app.post("/api/projetos", async (requisicao, resposta) => {
    const dados = esquemaNovoProjeto.parse(requisicao.body);
    return resposta.code(201).send(criarProjeto(dados));
  });

  app.put<{ Params: { id: string } }>("/api/projetos/:id", async (requisicao) =>
    editarProjeto(Number(requisicao.params.id), esquemaEdicaoProjeto.parse(requisicao.body)),
  );

  app.delete<{ Params: { id: string } }>("/api/projetos/:id", async (requisicao) =>
    excluirProjeto(Number(requisicao.params.id)),
  );
}
