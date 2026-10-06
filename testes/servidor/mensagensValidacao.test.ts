import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { formatarCaminho, formatarProblema } from "../../src/nucleo/mensagensValidacao.js";
import { esquemaDossie } from "../../src/dossie/dossie.js";

function msg(esquema: z.ZodType, valor: unknown): string {
  const resultado = esquema.safeParse(valor);
  assert.equal(resultado.success, false);
  return formatarProblema(resultado.error!.issues[0]!);
}

const geradas: string[] = [];
function conferir(obtida: string, esperada: string) {
  geradas.push(obtida);
  assert.equal(obtida, esperada);
}

test("too_big de número", () => conferir(msg(z.number().max(10), 12), "Deve ser no máximo 10"));
test("too_small de texto", () => conferir(msg(z.string().min(3), "a"), "Deve ter pelo menos 3 caracteres"));
test("too_small de lista", () => conferir(msg(z.array(z.string()).min(1), []), "Deve ter pelo menos 1 item"));
test("campo ausente", () => conferir(msg(z.object({ nome: z.string() }), {}), "nome: campo obrigatório"));
test("tipo errado", () => conferir(msg(z.number(), "x"), "Tipo inválido: esperado número"));
test("enum", () => conferir(msg(z.enum(["a", "b"]), "c"), "Valor inválido: use um destes: a, b"));
test("chave desconhecida", () => conferir(msg(z.strictObject({}), { x: 1 }), "Campo não reconhecido: x"));

test("caminho legível", () => {
  assert.equal(formatarCaminho(["personagens", 1, "aparenciaFixa"]), "Personagens › item 2 › Aparência fixa");
});

test("problema com caminho", () => {
  const dossie = {
    personagens: [
      { nome: "Léo", aparenciaFixa: "Menino de 11 anos" },
      { aparenciaFixa: "Dragão azul pequeno" },
    ],
  };
  conferir(msg(esquemaDossie, dossie), "Personagens › item 2 › nome: campo obrigatório");
});

test("mensagem da regra tem prioridade", () => {
  conferir(msg(z.number().min(5, "A duração mínima é 5 minutos"), 1), "A duração mínima é 5 minutos");
});

test("nenhuma mensagem em inglês nem pt-PT", () => {
  assert.ok(geradas.length >= 9);
  for (const m of geradas) assert.doesNotMatch(m, /Too |Invalid|expected|Demasiado|esperava que/);
});
