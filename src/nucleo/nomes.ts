import path from "node:path";
import { ErroAplicacao } from "./erros.js";

type PlatformPath = typeof path.posix;

// Nomes que o Windows não aceita como arquivo ou pasta, com ou sem extensão.
const RESERVADOS = new Set([
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

function ehReservado(nome: string): boolean {
  return RESERVADOS.has(nome.toLowerCase().split(".")[0] ?? "");
}

// Gera um nome de pasta sem acento e sem caractere especial: "Léo e o Dragão" -> "leo-e-o-dragao".
export function gerarSlug(texto: string): string {
  const slug = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ehReservado(slug) ? `${slug}-projeto` : slug;
}

// Nome de uma pasta nova digitado pelo usuário: não pode ter separador nem escapar da pasta atual.
export function validarNomeSimples(nome: string): string {
  const limpo = nome.trim();
  const invalido =
    !limpo ||
    limpo === "." ||
    limpo === ".." ||
    /[/\\:*?"<>|\u0000-\u001f]/.test(limpo) ||
    /[. ]$/.test(limpo) ||
    ehReservado(limpo);
  if (invalido) throw new ErroAplicacao(`Nome de pasta inválido: ${nome}`, 400);
  return limpo;
}

// Confere que `alvo` fica dentro de `base` (protege contra "../" e outra unidade de disco).
export function garantirDentroDe(base: string, alvo: string, caminhos: PlatformPath = path): string {
  const resolvido = caminhos.resolve(base, alvo);
  const relativo = caminhos.relative(caminhos.resolve(base), resolvido);
  if (relativo.startsWith("..") || caminhos.isAbsolute(relativo)) {
    throw new ErroAplicacao("Caminho fora da workspace", 400);
  }
  return resolvido;
}
