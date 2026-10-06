import { z } from "zod";

// Mensagens de validação em pt-BR. A tradução embutida do Zod (z.locales.pt) é de Portugal
// e não diz qual campo falhou, por isso não é usada. Mensagens escritas na própria regra
// (ex.: min(5, "A duração mínima é 5 minutos")) têm prioridade sobre estas.

const TIPOS: Record<string, string> = {
  string: "texto",
  number: "número",
  int: "número",
  boolean: "verdadeiro ou falso",
  array: "lista",
  object: "objeto",
};

const ROTULOS: Record<string, string> = {
  personagens: "Personagens",
  aparenciaFixa: "Aparência fixa",
  tracos: "Traços",
  fatos: "Fatos",
  fiosAbertos: "Fios abertos",
  linhaDoTempo: "Linha do tempo",
  esbocos: "Esboços",
  esbocosCapitulos: "Esboços",
  resumosCapitulos: "Resumos",
  sinopse: "Sinopse",
  mundo: "Mundo",
  cenas: "Cenas",
  duracaoPadraoMinutos: "Duração padrão",
  frequencia: "Frequência",
  clientId: "Client ID",
  clientSecret: "Client Secret",
  contextoTrabalho: "Contexto de trabalho",
};

function plural(quantidade: number | bigint, singular: string, plural: string): string {
  return `${quantidade} ${Number(quantidade) === 1 ? singular : plural}`;
}

function mensagemLimite(
  origem: string,
  limite: number | bigint,
  inclusivo: boolean,
  minimo: boolean,
): string {
  if (origem === "string") {
    return `${minimo ? "Deve ter pelo menos" : "Deve ter no máximo"} ${plural(limite, "caractere", "caracteres")}`;
  }
  if (origem === "array" || origem === "set") {
    return `${minimo ? "Deve ter pelo menos" : "Deve ter no máximo"} ${plural(limite, "item", "itens")}`;
  }
  if (minimo) return inclusivo ? `Deve ser no mínimo ${limite}` : `Deve ser maior que ${limite}`;
  return inclusivo ? `Deve ser no máximo ${limite}` : `Deve ser menor que ${limite}`;
}

function traduzir(problema: z.core.$ZodRawIssue): string {
  switch (problema.code) {
    case "too_small":
      return mensagemLimite(problema.origin, problema.minimum, problema.inclusive !== false, true);
    case "too_big":
      return mensagemLimite(problema.origin, problema.maximum, problema.inclusive !== false, false);
    case "invalid_type":
      if (problema.input === undefined) return "Campo obrigatório";
      return `Tipo inválido: esperado ${TIPOS[problema.expected] ?? problema.expected}`;
    case "invalid_format":
      if (problema.format === "email") return "E-mail inválido";
      if (problema.format === "url") return "Endereço (URL) inválido";
      return "Formato inválido";
    case "invalid_value":
      return `Valor inválido: use um destes: ${problema.values.map(String).join(", ")}`;
    case "unrecognized_keys":
      return `Campo não reconhecido: ${problema.keys.join(", ")}`;
    case "not_multiple_of":
      return `Deve ser múltiplo de ${problema.divisor}`;
    default:
      return "Valor inválido";
  }
}

export function configurarMensagensValidacao(): void {
  z.config({ customError: (problema) => traduzir(problema) });
}

// "personagens.1.aparenciaFixa" -> "Personagens › item 2 › Aparência fixa"
export function formatarCaminho(caminho: PropertyKey[]): string {
  return caminho
    .map((parte) => (typeof parte === "number" ? `item ${parte + 1}` : ROTULOS[String(parte)] ?? String(parte)))
    .join(" › ");
}

export function formatarProblema(problema: z.core.$ZodIssue): string {
  const caminho = formatarCaminho(problema.path);
  if (!caminho) return problema.message;
  return `${caminho}: ${problema.message.charAt(0).toLowerCase()}${problema.message.slice(1)}`;
}

configurarMensagensValidacao();
