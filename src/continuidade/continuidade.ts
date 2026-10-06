import { z } from "zod";
import { gerarJsonIa, type Mensagem } from "../ollama/ollama.js";
import { lerDossie } from "../dossie/dossie.js";
import { buscarProjetoPorId } from "../projetos/projetos.js";
import { lerUltimaVersaoRoteiro } from "../capitulos/capitulos.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { garantirModeloInstalado, resolverModelo } from "../ollama/modelos.js";
import type { ContextoExecucao } from "../tarefas/tipos.js";

export const esquemaContinuidade = z.object({
  problemas: z.array(
    z.object({
      tipo: z.enum(["nome", "aparencia", "fato", "linha_do_tempo", "personagem_ausente", "outro"]),
      descricao: z.string().min(5),
      sugestao: z.string().min(5),
    }),
  ),
});

// Compara o roteiro atual com o dossiê e lista contradições.
// Checagem rápida feita na rota (também serve para a proposta do dossiê).
export function validarPedidoComRoteiro(projetoId: number, numero: number) {
  const projeto = buscarProjetoPorId(projetoId);
  if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);
  const dossie = lerDossie(projeto.slug);
  if (!dossie) throw new ErroAplicacao("Este projeto ainda não tem dossiê.");
  const versao = lerUltimaVersaoRoteiro(projeto.slug, numero);
  if (!versao) throw new ErroAplicacao("Este capítulo ainda não tem roteiro.");
  return { projeto, dossie, versao };
}

export async function verificarContinuidade(
  projetoId: number,
  numero: number,
  opcoes: { modelo?: string; contexto?: ContextoExecucao } = {},
) {
  const { projeto, dossie, versao } = validarPedidoComRoteiro(projetoId, numero);
  opcoes.contexto?.relatarProgresso(10, "Preparando o contexto");
  const modelo = await garantirModeloInstalado(
    resolverModelo("principal", { modeloProjeto: projeto.modeloOllama, modeloEscolhido: opcoes.modelo }),
  );

  const mensagens: Mensagem[] = [
    {
      role: "system",
      content: [
        "Você é revisor de continuidade de histórias.",
        "Compare o roteiro com o dossiê e liste somente contradições reais:",
        "nomes trocados, aparência diferente da aparência fixa, fatos desfeitos, linha do tempo quebrada,",
        "personagem que some sem explicação. Se não houver problemas, devolva a lista vazia.",
        "Responda somente com o JSON pedido, em português.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `DOSSIÊ:\n${JSON.stringify(dossie, null, 2)}`,
        `ROTEIRO DO CAPÍTULO ${numero}:\n${JSON.stringify(versao.roteiro, null, 2)}`,
      ].join("\n\n"),
    },
  ];

  opcoes.contexto?.relatarProgresso(30, "Verificando a continuidade");
  const { dados: resultado } = await gerarJsonIa(modelo, mensagens, esquemaContinuidade, {
    tipo: "continuidade",
    sinal: opcoes.contexto?.sinal,
  });
  return { aprovado: resultado.problemas.length === 0, ...resultado };
}
