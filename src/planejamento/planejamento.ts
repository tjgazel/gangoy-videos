import { z } from "zod";
import { gerarJsonIa, type Mensagem } from "../ollama/ollama.js";
import { esquemaPersonagem, lerDossie, salvarDossie, type Dossie } from "../dossie/dossie.js";
import { buscarProjetoPorId, type Projeto } from "../projetos/projetos.js";
import { criarCapitulo, listarCapitulos, type Capitulo } from "../capitulos/capitulos.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { garantirModeloInstalado, resolverModelo } from "../ollama/modelos.js";
import type { ContextoExecucao } from "../tarefas/tipos.js";

export const esquemaPlanejamento = z.object({
  sinopse: z.string().min(20),
  mundo: z.string().min(5),
  personagens: z.array(esquemaPersonagem).min(1),
  esbocos: z
    .array(z.object({ titulo: z.string().min(2), resumo: z.string().min(10) }))
    .min(1, "Planeje pelo menos 1 capítulo")
    .max(60),
});

export type Planejamento = z.infer<typeof esquemaPlanejamento>;

// Propõe sinopse, personagens e a quantidade de capítulos para um enredo.
// Nada é gravado: o usuário revisa e confirma com confirmarPlanejamento.
// Checagem rápida feita na rota, antes de criar a tarefa.
export function validarPedidoPlanejamento(projetoId: number, enredo: string): Projeto {
  const projeto = buscarProjetoPorId(projetoId);
  if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);
  if (enredo.trim().length < 20) throw new ErroAplicacao("Descreva o enredo com pelo menos 20 caracteres");
  return projeto;
}

export async function proporPlanejamento(
  projetoId: number,
  enredo: string,
  opcoes: { modelo?: string; contexto?: ContextoExecucao } = {},
): Promise<Planejamento> {
  const projeto = validarPedidoPlanejamento(projetoId, enredo);
  opcoes.contexto?.relatarProgresso(10, "Preparando o contexto");
  const modelo = await garantirModeloInstalado(
    resolverModelo("principal", { modeloProjeto: projeto.modeloOllama, modeloEscolhido: opcoes.modelo }),
  );

  const palavrasPorCapitulo = Math.round(projeto.duracaoPadraoMinutos * 150);
  const mensagens: Mensagem[] = [
    {
      role: "system",
      content: [
        "Você planeja histórias para vídeos de desenho animado em português do Brasil.",
        `Cada capítulo deve render cerca de ${projeto.duracaoPadraoMinutos} minutos (${palavrasPorCapitulo} palavras de narração).`,
        "Escolha a quantidade de capítulos necessária para contar a história inteira, do início ao fim,",
        "sem deixar pontas soltas. Esboce cada capítulo com um título e um resumo curto que avance a trama.",
        "Crie personagens com aparência fixa detalhada, para o ilustrador manter o mesmo visual em todos os capítulos.",
        "Responda somente com o JSON pedido.",
      ].join(" "),
    },
    { role: "user", content: `ENREDO:\n${enredo.trim()}` },
  ];

  opcoes.contexto?.relatarProgresso(30, "Gerando o planejamento");
  return (await gerarJsonIa(modelo, mensagens, esquemaPlanejamento, { tipo: "planejamento", sinal: opcoes.contexto?.sinal })).dados;
}

// Grava o dossiê inicial e cria os capítulos planejados.
// Recusa se o projeto já tiver dossiê, para não apagar uma história em andamento.
export function confirmarPlanejamento(
  projetoId: number,
  planejamento: Planejamento,
): { dossie: Dossie; capitulos: Capitulo[] } {
  const projeto: Projeto | null = buscarProjetoPorId(projetoId);
  if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);
  if (lerDossie(projeto.slug)) {
    throw new ErroAplicacao("Este projeto já tem dossiê. Edite o dossiê ou crie outro projeto.", 409);
  }
  if (listarCapitulos(projetoId).length > 0) {
    throw new ErroAplicacao("Este projeto já tem capítulos planejados.", 409);
  }

  const esbocos = planejamento.esbocos.map((esboco, indice) => ({
    numero: indice + 1,
    titulo: esboco.titulo,
    resumo: esboco.resumo,
  }));

  const dossie: Dossie = {
    sinopse: planejamento.sinopse,
    mundo: planejamento.mundo,
    personagens: planejamento.personagens,
    linhaDoTempo: [],
    fatos: [],
    fiosAbertos: [],
    esbocosCapitulos: esbocos,
    resumosCapitulos: [],
  };
  salvarDossie(projeto.slug, dossie);

  const capitulos = esbocos.map((esboco) =>
    criarCapitulo(projetoId, esboco.numero, esboco.titulo, projeto.duracaoPadraoMinutos),
  );
  return { dossie, capitulos };
}
