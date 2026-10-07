import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { obterConfiguracoesSistema, salvarConfiguracao } from "../configuracoes/sistema.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { garantirModeloInstalado, listarModelos, normalizarNomeModelo } from "../ollama/modelos.js";

const esquemaConfiguracoes = z
  .object({
    modeloPrincipal: z.string().trim().min(1),
    modeloLeve: z.string().trim().min(1),
    contextoTrabalho: z
      .number()
      .int()
      .min(4096, "O contexto de trabalho mínimo é 4.096 tokens")
      .max(262144, "O contexto de trabalho máximo é 262.144 tokens"),
  })
  .partial();

export function registrarRotasConfiguracoes(app: FastifyInstance): void {
  app.get("/api/ollama/modelos", async () => listarModelos());

  app.get("/api/configuracoes", async () => obterConfiguracoesSistema());

  app.put("/api/configuracoes", async (requisicao) => {
    const dados = esquemaConfiguracoes.parse(requisicao.body);
    // Confere com o Ollama: só modelos instalados e contexto dentro do que o modelo aceita.
    const modelos = await listarModelos();
    const atual = obterConfiguracoesSistema();
    const principal = dados.modeloPrincipal ? await garantirModeloInstalado(dados.modeloPrincipal) : atual.modeloPrincipal;
    const leve = dados.modeloLeve ? await garantirModeloInstalado(dados.modeloLeve) : atual.modeloLeve;
    const contexto = dados.contextoTrabalho ?? atual.contextoTrabalho;

    const maximo = modelos.find((m) => normalizarNomeModelo(m.nome) === normalizarNomeModelo(principal))?.contextoMaximo;
    if (maximo && contexto > maximo) {
      throw new ErroAplicacao(
        `O modelo ${principal} aceita no máximo ${maximo.toLocaleString("pt-BR")} tokens de contexto`,
        400,
      );
    }

    salvarConfiguracao("modelo_principal", principal);
    salvarConfiguracao("modelo_leve", leve);
    salvarConfiguracao("contexto_trabalho", String(contexto));
    return obterConfiguracoesSistema();
  });
}
