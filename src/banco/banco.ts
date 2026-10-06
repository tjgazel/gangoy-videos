import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ErroAplicacao } from "../nucleo/erros.js";

let conexao: DatabaseSync | null = null;

// Abre (ou cria) o banco SQLite no caminho indicado e garante as tabelas.
export function abrirBanco(caminhoArquivo: string): DatabaseSync {
  fecharBanco();
  mkdirSync(dirname(caminhoArquivo), { recursive: true });

  conexao = new DatabaseSync(caminhoArquivo);
  conexao.exec("PRAGMA journal_mode = WAL;");
  conexao.exec("PRAGMA foreign_keys = ON;");

  conexao.exec(`
    CREATE TABLE IF NOT EXISTS projetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      tematica TEXT NOT NULL DEFAULT '',
      id_canal TEXT NOT NULL DEFAULT '',
      id_playlist TEXT NOT NULL DEFAULT '',
      frequencia TEXT NOT NULL DEFAULT '',
      duracao_padrao_minutos INTEGER NOT NULL DEFAULT 8,
      idioma TEXT NOT NULL DEFAULT 'pt-BR',
      modelo_ollama TEXT NOT NULL DEFAULT 'gemma4:12b-it-qat',
      criado_em TEXT NOT NULL
    );

    -- Tokens de cada canal conectado.
    CREATE TABLE IF NOT EXISTS contas_youtube (
      id_canal TEXT PRIMARY KEY,
      titulo_canal TEXT NOT NULL DEFAULT '',
      token_acesso TEXT NOT NULL DEFAULT '',
      token_atualizacao TEXT NOT NULL,
      token_expira_em TEXT NOT NULL DEFAULT '',
      conectado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tarefas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      chave TEXT NOT NULL,
      projeto_id INTEGER REFERENCES projetos(id) ON DELETE CASCADE,
      capitulo_numero INTEGER,
      parametros TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'na_fila',
      progresso INTEGER NOT NULL DEFAULT 0,
      mensagem TEXT NOT NULL DEFAULT '',
      resultado TEXT,
      erro TEXT,
      criada_em TEXT NOT NULL,
      iniciada_em TEXT,
      concluida_em TEXT
    );
    CREATE INDEX IF NOT EXISTS indice_tarefas_status ON tarefas (status);
    CREATE TABLE IF NOT EXISTS capitulos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      numero INTEGER NOT NULL,
      titulo TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planejado',
      duracao_alvo_minutos INTEGER NOT NULL,
      criado_em TEXT NOT NULL,
      UNIQUE (projeto_id, numero)
    );
  `);

  return conexao;
}

export function fecharBanco(): void {
  if (!conexao) return;
  conexao.close();
  conexao = null;
}

export function bancoAberto(): boolean {
  return conexao !== null;
}

export function obterBanco(): DatabaseSync {
  if (!conexao) throw new ErroAplicacao("Nenhuma workspace aberta", 503);
  return conexao;
}
