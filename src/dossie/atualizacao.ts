import { z } from "zod";
import { gerarJsonIa, type Mensagem } from "../ollama/ollama.js";
import { lerDossie, esquemaPersonagem, salvarDossie, type Dossie } from "./dossie.js";
import { buscarProjetoPorId } from "../projetos/projetos.js";
import { lerUltimaVersaoRoteiro, atualizarStatusCapitulo, buscarCapitulo } from "../capitulos/capitulos.js";
import { garantirModeloInstalado, resolverModelo } from "../ollama/modelos.js";
import { validarPedidoComRoteiro } from "../continuidade/continuidade.js";
import type { ContextoExecucao } from "../tarefas/tipos.js";
import { ErroAplicacao } from "../nucleo/erros.js";

export const esquemaAtualizacao = z.object({
  resumoCapitulo: z.string().min(10),
  novosPersonagens: z.array(esquemaPersonagem).default([]),
  novosFatos: z.array(z.string()).default([]),
  fiosAbertos: z.array(z.string()).default([]),
  fiosResolvidos: z.array(z.string()).default([]),
});

export type Atualizacao = z.infer<typeof esquemaAtualizacao>;

// Usa o modelo leve para extrair do roteiro aprovado o que passa a ser canônico.
// Nada é gravado aqui: o usuário revisa a proposta e só depois chama aplicarAtualizacaoDossie.
export async function proporAtualizacaoDossie(
  projetoId: number,
  numero: number,
  opcoes: { modelo?: string; contexto?: ContextoExecucao } = {},
): Promise<Atualizacao> {
  const { dossie, versao } = validarPedidoComRoteiro(projetoId, numero);
  opcoes.contexto?.relatarProgresso(10, "Preparando o contexto");
  const modelo = await garantirModeloInstalado(resolverModelo("leve", { modeloEscolhido: opcoes.modelo }));

  const mensagens: Mensagem[] = [
    {
      role: "system",
      content: [
        "Você extrai da narrativa o que passa a valer como fato canônico da história.",
        "Liste apenas novidades do capítulo: personagens novos (com aparência fixa), fatos novos,",
        "fios abertos novos e fios resolvidos. Escreva um resumo curto do capítulo.",
        "Responda somente com o JSON pedido, em português.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `DOSSIÊ ATUAL:\n${JSON.stringify(dossie, null, 2)}`,
        `ROTEIRO APROVADO DO CAPÍTULO ${numero}:\n${JSON.stringify(versao.roteiro, null, 2)}`,
      ].join("\n\n"),
    },
  ];

  opcoes.contexto?.relatarProgresso(30, "Propondo a atualização do dossiê");
  return (await gerarJsonIa(modelo, mensagens, esquemaAtualizacao, { tipo: "proposta_dossie", sinal: opcoes.contexto?.sinal })).dados;
}

// Aplica a proposta (já revisada pelo usuário) ao dossiê e aprova o capítulo.
export function aplicarAtualizacaoDossie(projetoId: number, numero: number, atualizacao: Atualizacao): Dossie {
  const projeto = buscarProjetoPorId(projetoId);
  if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);

  const dossie = lerDossie(projeto.slug);
  if (!dossie) throw new ErroAplicacao("Este projeto ainda não tem dossiê.");
  const capitulo = buscarCapitulo(projetoId, numero);
  if (!capitulo) throw new ErroAplicacao(`O capítulo ${numero} não está planejado`, 404);

  const nomesExistentes = new Set(dossie.personagens.map((personagem) => personagem.nome));
  const personagensNovos = atualizacao.novosPersonagens.filter((personagem) => !nomesExistentes.has(personagem.nome));

  const atualizado: Dossie = {
    ...dossie,
    personagens: [...dossie.personagens, ...personagensNovos],
    fatos: [
      ...dossie.fatos,
      ...atualizacao.novosFatos.map((descricao) => ({ capitulo: numero, descricao })),
    ],
    fiosAbertos: [
      ...dossie.fiosAbertos.filter((fio) => !atualizacao.fiosResolvidos.includes(fio)),
      ...atualizacao.fiosAbertos.filter((fio) => !dossie.fiosAbertos.includes(fio)),
    ],
    resumosCapitulos: [
      ...dossie.resumosCapitulos.filter((item) => item.numero !== numero),
      { numero, resumo: atualizacao.resumoCapitulo },
    ].sort((a, b) => a.numero - b.numero),
  };

  salvarDossie(projeto.slug, atualizado);
  atualizarStatusCapitulo(projetoId, numero, "aprovado");
  return atualizado;
}
