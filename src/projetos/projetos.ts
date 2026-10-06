import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { obterBanco } from "../banco/banco.js";
import { lerConfiguracaoApp } from "../nucleo/configuracaoApp.js";
import { pastaLixeira as obterPastaLixeira, pastaProjeto } from "../workspace/caminhos.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { gerarSlug } from "../nucleo/nomes.js";

const expressaoFrequencia = /^(diaria|semanal:(seg|ter|qua|qui|sex|sab|dom):([01]\d|2[0-3]):[0-5]\d)$/;

export const esquemaNovoProjeto = z.object({
  nome: z.string().trim().min(2, "Informe um nome com pelo menos 2 letras"),
  tematica: z.string().trim().default(""),
  idCanal: z.string().trim().default(""),
  idPlaylist: z.string().trim().default(""),
  frequencia: z
    .string()
    .trim()
    .regex(expressaoFrequencia, "Use 'diaria' ou 'semanal:ter:18:00' (dia seg a dom, hora HH:MM)")
    .default("semanal:ter:18:00"),
  duracaoPadraoMinutos: z
    .number()
    .int()
    .min(5, "A duração mínima é 5 minutos")
    .max(10, "A duração máxima é 10 minutos")
    .default(8),
  modeloOllama: z.string().trim().default(""),
});

export type NovoProjeto = z.infer<typeof esquemaNovoProjeto>;

export interface Projeto {
  id: number;
  nome: string;
  slug: string;
  tematica: string;
  idCanal: string;
  idPlaylist: string;
  frequencia: string;
  duracaoPadraoMinutos: number;
  idioma: string;
  modeloOllama: string;
  criadoEm: string;
}

interface LinhaProjeto {
  id: number;
  nome: string;
  slug: string;
  tematica: string;
  id_canal: string;
  id_playlist: string;
  frequencia: string;
  duracao_padrao_minutos: number;
  idioma: string;
  modelo_ollama: string;
  criado_em: string;
}

function converterLinha(linha: LinhaProjeto): Projeto {
  return {
    id: linha.id,
    nome: linha.nome,
    slug: linha.slug,
    tematica: linha.tematica,
    idCanal: linha.id_canal,
    idPlaylist: linha.id_playlist,
    frequencia: linha.frequencia,
    duracaoPadraoMinutos: linha.duracao_padrao_minutos,
    idioma: linha.idioma,
    modeloOllama: linha.modelo_ollama,
    criadoEm: linha.criado_em,
  };
}

export function listarProjetos(): Projeto[] {
  const linhas = obterBanco()
    .prepare("SELECT * FROM projetos ORDER BY nome")
    .all() as unknown as LinhaProjeto[];
  return linhas.map(converterLinha);
}

export function buscarProjetoPorId(id: number): Projeto | null {
  const linha = obterBanco()
    .prepare("SELECT * FROM projetos WHERE id = ?")
    .get(id) as unknown as LinhaProjeto | undefined;
  return linha ? converterLinha(linha) : null;
}

export function criarProjeto(dados: NovoProjeto): Projeto {
  const banco = obterBanco();
  const config = lerConfiguracaoApp();
  const slug = gerarSlug(dados.nome);

  if (!slug) throw new ErroAplicacao("O nome do projeto precisa ter letras ou números");
  // Compara com o slug (pasta) e com o nome atual: um projeto renomeado mantém o slug antigo.
  const existente = banco.prepare("SELECT id FROM projetos WHERE slug = ?").get(slug);
  const mesmoNome = listarProjetos().some((outro) => gerarSlug(outro.nome) === slug);
  if (mesmoNome) throw new ErroAplicacao(`Já existe um projeto com o nome "${dados.nome}"`);
  if (existente) throw new ErroAplicacao(`A pasta "${slug}" já é usada por outro projeto (renomeado). Escolha outro nome.`);

  // Vazio = seguir o modelo principal do sistema (Configurações).
  const modelo = dados.modeloOllama;
  const criadoEm = new Date().toISOString();

  const resultado = banco
    .prepare(`
      INSERT INTO projetos
        (nome, slug, tematica, id_canal, id_playlist, frequencia,
         duracao_padrao_minutos, idioma, modelo_ollama, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pt-BR', ?, ?)
    `)
    .run(
      dados.nome,
      slug,
      dados.tematica,
      dados.idCanal,
      dados.idPlaylist,
      dados.frequencia,
      dados.duracaoPadraoMinutos,
      modelo,
      criadoEm,
    );

  // Pasta própria do projeto, onde ficarão o dossiê e os capítulos.
  mkdirSync(pastaProjeto(slug), { recursive: true });

  return buscarProjetoPorId(Number(resultado.lastInsertRowid)) as Projeto;
}

// Na edição todos os campos são opcionais; o slug (nome da pasta) não muda, para não perder os arquivos.
export const esquemaEdicaoProjeto = esquemaNovoProjeto
  .extend({
    tematica: z.string().trim(),
    idCanal: z.string().trim(),
    idPlaylist: z.string().trim(),
    frequencia: z
      .string()
      .trim()
      .regex(expressaoFrequencia, "Use 'diaria' ou 'semanal:ter:18:00' (dia seg a dom, hora HH:MM)"),
    duracaoPadraoMinutos: z.number().int().min(5, "A duração mínima é 5 minutos").max(10, "A duração máxima é 10 minutos"),
    modeloOllama: z.string().trim(),
  })
  .partial();

export type EdicaoProjeto = z.infer<typeof esquemaEdicaoProjeto>;

export function editarProjeto(id: number, dados: EdicaoProjeto): Projeto {
  const banco = obterBanco();
  const atual = buscarProjetoPorId(id);
  if (!atual) throw new ErroAplicacao("Projeto não encontrado", 404);

  const nome = dados.nome ?? atual.nome;
  if (!gerarSlug(nome)) throw new ErroAplicacao("O nome do projeto precisa ter letras ou números");
  const repetido = listarProjetos().find(
    (outro) => outro.id !== id && gerarSlug(outro.nome) === gerarSlug(nome),
  );
  if (repetido) throw new ErroAplicacao(`Já existe um projeto com o nome "${nome}"`);

  banco
    .prepare(`
      UPDATE projetos SET
        nome = ?, tematica = ?, id_canal = ?, id_playlist = ?, frequencia = ?,
        duracao_padrao_minutos = ?, modelo_ollama = ?
      WHERE id = ?
    `)
    .run(
      nome,
      dados.tematica ?? atual.tematica,
      dados.idCanal ?? atual.idCanal,
      dados.idPlaylist ?? atual.idPlaylist,
      dados.frequencia ?? atual.frequencia,
      dados.duracaoPadraoMinutos ?? atual.duracaoPadraoMinutos,
      dados.modeloOllama ?? atual.modeloOllama,
      id,
    );

  return buscarProjetoPorId(id) as Projeto;
}

// Remove o projeto do banco (capítulos vão junto) e move a pasta para dados/lixeira/,
// para que dossiê e roteiros possam ser recuperados à mão.
export function excluirProjeto(id: number): { pastaLixeira: string | null } {
  const projeto = buscarProjetoPorId(id);
  if (!projeto) throw new ErroAplicacao("Projeto não encontrado", 404);

  const origem = pastaProjeto(projeto.slug);
  let pastaLixeira: string | null = null;
  if (existsSync(origem)) {
    const lixeira = obterPastaLixeira();
    mkdirSync(lixeira, { recursive: true });
    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    pastaLixeira = resolve(lixeira, `${projeto.slug}-${carimbo}`);
    renameSync(origem, pastaLixeira);
  }

  obterBanco().prepare("DELETE FROM projetos WHERE id = ?").run(id);
  return { pastaLixeira };
}
