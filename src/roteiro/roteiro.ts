import { z } from "zod";
import { gerarJsonIa, type Mensagem, type MedicaoContexto } from "../ollama/ollama.js";
import { ErroContextoInsuficiente, type TipoChamada } from "../ollama/contexto.js";
import { garantirModeloInstalado, resolverModelo } from "../ollama/modelos.js";
import { lerDossie, type Dossie } from "../dossie/dossie.js";
import { buscarProjetoPorId, type Projeto } from "../projetos/projetos.js";
import {
  buscarCapitulo,
  lerUltimaVersaoRoteiro,
  salvarNovaVersaoRoteiro,
  atualizarStatusCapitulo,
  type VersaoRoteiro,
} from "../capitulos/capitulos.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import type { ContextoExecucao } from "../tarefas/tipos.js";

// Ritmo de narração em pt-BR usado para estimar a duração do texto.
export const PALAVRAS_POR_MINUTO = 150;

export const esquemaCena = z.object({
  narracao: z.string().min(10, "Cada cena precisa de narração"),
  personagensPresentes: z.array(z.string()).min(1, "Informe quem aparece na cena"),
  descricaoVisual: z.string().min(10, "Descreva a imagem da cena"),
});

export const esquemaRoteiro = z.object({
  titulo: z.string().min(2),
  cenas: z.array(esquemaCena).min(3, "O roteiro precisa de pelo menos 3 cenas").max(60),
});

export type Roteiro = z.infer<typeof esquemaRoteiro>;

export interface OpcoesGeracao {
  modelo?: string;
  contexto?: ContextoExecucao;
}

export function contarPalavras(roteiro: Roteiro): number {
  return roteiro.cenas
    .map((cena) => cena.narracao.trim().split(/\s+/).length)
    .reduce((total, quantidade) => total + quantidade, 0);
}

function instrucoesDeFormato(alvoMinutos: number): string {
  const palavras = Math.round(alvoMinutos * PALAVRAS_POR_MINUTO);
  return [
    "Você é roteirista de histórias para vídeos de desenho animado em português do Brasil.",
    "Regras obrigatórias:",
    "- Mantenha nomes, aparência, traços e fatos dos personagens exatamente como estão no dossiê.",
    "- Não contradiga fatos já estabelecidos nem o resumo dos capítulos anteriores.",
    "- Personagens novos só podem ser secundários e devem ser listados em personagensPresentes.",
    "- Use nomes de personagens exatamente como constam no dossiê.",
    "- A narração é falada em voz alta: frases curtas e claras, sem markdown.",
    "- A descricaoVisual é em português e descreve o cenário, a ação e o enquadramento para um ilustrador.",
    `- Escreva a narração total com cerca de ${palavras} palavras (${alvoMinutos} minutos de vídeo).`,
    "Responda somente com o JSON pedido.",
  ].join("\n");
}

function resumirDossie(dossie: Dossie): string {
  return JSON.stringify(
    {
      sinopse: dossie.sinopse,
      mundo: dossie.mundo,
      personagens: dossie.personagens,
      fatos: dossie.fatos,
      fiosAbertos: dossie.fiosAbertos,
      resumosCapitulos: dossie.resumosCapitulos,
    },
    null,
    2,
  );
}

function textoDoCapitulo(versao: VersaoRoteiro): string {
  return versao.roteiro.cenas.map((cena) => cena.narracao).join("\n");
}

function exigirProjeto(projetoId: number): Projeto {
  const projeto = buscarProjetoPorId(projetoId);
  if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);
  return projeto;
}

function carregarContexto(projeto: Projeto, numero: number) {
  const dossie = lerDossie(projeto.slug);
  if (!dossie) throw new ErroAplicacao("Este projeto ainda não tem dossiê. Faça o planejamento primeiro.");
  const capitulo = buscarCapitulo(projeto.id, numero);
  if (!capitulo) throw new ErroAplicacao(`O capítulo ${numero} não está planejado`, 404);
  const esbocoDoCapitulo = dossie.esbocosCapitulos.find((item) => item.numero === numero);
  const anterior = numero > 1 ? lerUltimaVersaoRoteiro(projeto.slug, numero - 1) : null;
  return { dossie, capitulo, esbocoDoCapitulo, anterior };
}

// Checagens rápidas feitas na rota, antes de criar a tarefa (o erro volta na hora).
export function validarPedidoRoteiro(projetoId: number, numero: number, instrucao?: string): void {
  const projeto = exigirProjeto(projetoId);
  carregarContexto(projeto, numero);
  if (instrucao === undefined) return;
  if (!instrucao.trim()) throw new ErroAplicacao("Escreva o que deve ser corrigido");
  if (!lerUltimaVersaoRoteiro(projeto.slug, numero)) {
    throw new ErroAplicacao("Este capítulo ainda não tem roteiro para refazer. Gere o roteiro primeiro.");
  }
}

async function executarRoteiro(
  projeto: Projeto,
  numero: number,
  montarMensagens: (usarResumoDoAnterior: boolean) => Mensagem[],
  instrucao: string,
  alvoMinutos: number,
  tipo: TipoChamada,
  opcoes: OpcoesGeracao,
): Promise<VersaoRoteiro> {
  const progresso = opcoes.contexto?.relatarProgresso ?? (() => {});
  const sinal = opcoes.contexto?.sinal;
  progresso(10, "Preparando o contexto");
  const modelo = await garantirModeloInstalado(
    resolverModelo("principal", { modeloProjeto: projeto.modeloOllama, modeloEscolhido: opcoes.modelo }),
  );
  const alvoPalavras = Math.round(alvoMinutos * PALAVRAS_POR_MINUTO);
  const medicoes: MedicaoContexto[] = [];

  progresso(30, "Gerando roteiro");
  let mensagens = montarMensagens(false);
  let resposta;
  try {
    resposta = await gerarJsonIa(modelo, mensagens, esquemaRoteiro, { tipo, sinal });
  } catch (erro) {
    // O texto integral do capítulo anterior é o que pode sair: o dossiê nunca é cortado.
    if (!(erro instanceof ErroContextoInsuficiente)) throw erro;
    mensagens = montarMensagens(true);
    resposta = await gerarJsonIa(modelo, mensagens, esquemaRoteiro, { tipo, sinal });
  }
  medicoes.push(resposta.medicao);
  let roteiro = resposta.dados;
  let palavras = contarPalavras(roteiro);

  // Modelos costumam escrever menos do que o pedido: pede uma ampliação uma vez.
  // Se o pedido de ampliação não couber no contexto, fica o roteiro já gerado (mais curto que o alvo).
  if (palavras < alvoPalavras * 0.8) {
    progresso(70, "Ampliando o texto");
    try {
      const ampliacao = await gerarJsonIa(
        modelo,
        [
          ...mensagens,
          { role: "assistant", content: JSON.stringify(roteiro) },
          {
            role: "user",
            content: `O roteiro ficou com ${palavras} palavras de narração, mas o alvo é de ${alvoPalavras}. Amplie as narrações e acrescente cenas para chegar perto do alvo, sem mudar a história nem os fatos. Responda com o JSON completo.`,
          },
        ],
        esquemaRoteiro,
        { tipo, sinal },
      );
      medicoes.push(ampliacao.medicao);
      roteiro = ampliacao.dados;
      palavras = contarPalavras(roteiro);
    } catch (erro) {
      if (!(erro instanceof ErroContextoInsuficiente)) throw erro;
    }
  }

  progresso(95, "Salvando a versão");
  const ultima = medicoes[medicoes.length - 1]!;
  const versao = salvarNovaVersaoRoteiro(projeto.slug, numero, {
    instrucao,
    roteiro,
    palavras,
    minutosEstimados: Math.round((palavras / PALAVRAS_POR_MINUTO) * 10) / 10,
    modelo,
    duracaoGeracaoSegundos: Math.round(medicoes.reduce((total, m) => total + m.duracaoSegundos, 0) * 10) / 10,
    contexto: {
      numCtx: ultima.numCtx,
      tokensPrompt: ultima.tokensPrompt,
      tokensResposta: ultima.tokensResposta,
      possivelCorte: medicoes.some((m) => m.possivelCorte),
      percentualCpu: ultima.percentualCpu,
    },
  });
  atualizarStatusCapitulo(projeto.id, numero, "roteiro_gerado");
  return versao;
}

export async function gerarRoteiroCapitulo(projetoId: number, numero: number, opcoes: OpcoesGeracao = {}) {
  const projeto = exigirProjeto(projetoId);
  const { dossie, capitulo, esbocoDoCapitulo, anterior } = carregarContexto(projeto, numero);

  const montarMensagens = (usarResumoDoAnterior: boolean): Mensagem[] => {
    let ultimoTexto = "Este é o primeiro capítulo da história.";
    if (anterior && !usarResumoDoAnterior) {
      ultimoTexto = `Texto do capítulo ${numero - 1} (último já escrito):\n${textoDoCapitulo(anterior)}`;
    } else if (anterior) {
      const resumo =
        dossie.resumosCapitulos.find((item) => item.numero === numero - 1)?.resumo ??
        dossie.esbocosCapitulos.find((item) => item.numero === numero - 1)?.resumo ??
        "";
      ultimoTexto = `Resumo do capítulo ${numero - 1} (o texto integral não coube no contexto):\n${resumo}`;
    }
    return [
      { role: "system", content: instrucoesDeFormato(capitulo.duracaoAlvoMinutos) },
      {
        role: "user",
        content: [
          `DOSSIÊ DA HISTÓRIA:\n${resumirDossie(dossie)}`,
          `ESBOÇO DO CAPÍTULO ${numero}:\n${esbocoDoCapitulo ? `${esbocoDoCapitulo.titulo}: ${esbocoDoCapitulo.resumo}` : "Sem esboço; siga a sinopse."}`,
          ultimoTexto,
          `Escreva o roteiro do capítulo ${numero}, continuando a história exatamente de onde o capítulo anterior parou.`,
        ].join("\n\n"),
      },
    ];
  };

  return executarRoteiro(projeto, numero, montarMensagens, "", capitulo.duracaoAlvoMinutos, "roteiro", opcoes);
}

export async function refazerRoteiroCapitulo(
  projetoId: number,
  numero: number,
  instrucao: string,
  opcoes: OpcoesGeracao = {},
) {
  validarPedidoRoteiro(projetoId, numero, instrucao);
  const projeto = exigirProjeto(projetoId);
  const { dossie, capitulo } = carregarContexto(projeto, numero);
  const atual = lerUltimaVersaoRoteiro(projeto.slug, numero) as VersaoRoteiro;

  const montarMensagens = (): Mensagem[] => [
    { role: "system", content: instrucoesDeFormato(capitulo.duracaoAlvoMinutos) },
    {
      role: "user",
      content: [
        `DOSSIÊ DA HISTÓRIA:\n${resumirDossie(dossie)}`,
        `ROTEIRO ATUAL DO CAPÍTULO ${numero}:\n${JSON.stringify(atual.roteiro, null, 2)}`,
        `CORREÇÃO PEDIDA PELO USUÁRIO:\n${instrucao}`,
        "Reescreva o roteiro aplicando a correção. Mantenha intacto o que não foi pedido para mudar e preserve a continuidade com o dossiê.",
      ].join("\n\n"),
    },
  ];

  return executarRoteiro(projeto, numero, montarMensagens, instrucao, capitulo.duracaoAlvoMinutos, "refazer", opcoes);
}
