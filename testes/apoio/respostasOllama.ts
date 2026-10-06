import type { CorpoChatFalso, RespostaChatFalsa } from "./ollamaFalso.js";

// Respostas prontas do Ollama falso, escolhidas pelo formato (esquema JSON) pedido na chamada.

function narracao(numero: number): string {
  const frase = `Na cena ${numero}, Léo caminhou pela margem do lago seco ao lado de Brisa, o pequeno dragão azul, e os dois observaram a vila em silêncio.`;
  const palavras = frase.split(" ");
  // 150 palavras por cena: 8 cenas = 1.200 palavras (8 minutos de narração).
  return Array.from({ length: 150 }, (_, i) => palavras[i % palavras.length]).join(" ");
}

export function roteiroFalso() {
  return {
    titulo: "O Ovo do Lago",
    cenas: Array.from({ length: 8 }, (_, i) => ({
      narracao: narracao(i + 1),
      personagensPresentes: ["Léo", "Brisa"],
      descricaoVisual: `Léo e Brisa na beira do lago seco, plano aberto, cena ${i + 1}`,
    })),
  };
}

export function planejamentoFalso() {
  return {
    sinopse: "Léo encontra um ovo mágico e um dragãozinho chamado Brisa; juntos salvam a vila da seca.",
    mundo: "Vila das Águas, à beira de um lago, cercada de montanhas.",
    personagens: [
      {
        nome: "Léo",
        papel: "Protagonista",
        aparenciaFixa: "Menino de 11 anos, cabelo castanho bagunçado, camisa de linho bege.",
        tracos: ["Curioso", "Corajoso"],
        caminhoReferencia: "",
      },
      {
        nome: "Brisa",
        papel: "Dragão companheiro",
        aparenciaFixa: "Dragão filhote azul-claro com asas translúcidas.",
        tracos: ["Brincalhão"],
        caminhoReferencia: "",
      },
    ],
    esbocos: [
      { titulo: "O Ovo do Lago", resumo: "Léo pesca um ovo brilhante e Brisa nasce." },
      { titulo: "O Chamado das Montanhas", resumo: "Os dois partem atrás da Pedra da Chuva." },
      { titulo: "A Pedra da Chuva", resumo: "A chuva volta e a vila é salva." },
    ],
  };
}

export function atualizacaoFalsa() {
  return {
    resumoCapitulo: "Léo encontra o ovo e Brisa nasce na beira do lago.",
    novosPersonagens: [],
    novosFatos: ["Brisa nasce do ovo encontrado no lago."],
    fiosAbertos: [],
    fiosResolvidos: [],
  };
}

export function respostaPadraoOllama(corpo: CorpoChatFalso): RespostaChatFalsa {
  const campos = Object.keys(corpo.format?.properties ?? {});
  if (campos.includes("cenas")) return { conteudo: roteiroFalso() };
  if (campos.includes("esbocos")) return { conteudo: planejamentoFalso() };
  if (campos.includes("problemas")) return { conteudo: { problemas: [] } };
  if (campos.includes("resumoCapitulo")) return { conteudo: atualizacaoFalsa() };
  return { conteudo: {} };
}
