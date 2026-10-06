import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Reproduz o formato anterior à workspace: dados/app.db e dados/projetos/<slug>/capitulos/NNN/versoes/.
export function criarDadosAntigos(pastaDados: string): void {
  mkdirSync(pastaDados, { recursive: true });
  const banco = new DatabaseSync(join(pastaDados, "app.db"));
  banco.exec("PRAGMA journal_mode = WAL;");
  banco.exec(`
    CREATE TABLE projetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      tematica TEXT NOT NULL DEFAULT '', id_canal TEXT NOT NULL DEFAULT '', id_playlist TEXT NOT NULL DEFAULT '',
      frequencia TEXT NOT NULL DEFAULT '', duracao_padrao_minutos INTEGER NOT NULL DEFAULT 8,
      idioma TEXT NOT NULL DEFAULT 'pt-BR', modelo_ollama TEXT NOT NULL DEFAULT 'gemma4:12b-it-qat', criado_em TEXT NOT NULL
    );
    CREATE TABLE contas_youtube (
      id_canal TEXT PRIMARY KEY, titulo_canal TEXT NOT NULL DEFAULT '', token_acesso TEXT NOT NULL DEFAULT '',
      token_atualizacao TEXT NOT NULL, token_expira_em TEXT NOT NULL DEFAULT '', conectado_em TEXT NOT NULL
    );
    CREATE TABLE capitulos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      numero INTEGER NOT NULL, titulo TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planejado',
      duracao_alvo_minutos INTEGER NOT NULL, criado_em TEXT NOT NULL, UNIQUE (projeto_id, numero)
    );
  `);
  const agora = new Date().toISOString();
  banco
    .prepare("INSERT INTO projetos (nome, slug, modelo_ollama, criado_em) VALUES (?, ?, ?, ?)")
    .run("Léo e o Dragão", "leo-e-o-dragao", "gemma4:12b-it-qat", agora);
  const inserirCapitulo = banco.prepare(
    "INSERT INTO capitulos (projeto_id, numero, titulo, status, duracao_alvo_minutos, criado_em) VALUES (1, ?, ?, ?, 8, ?)",
  );
  inserirCapitulo.run(1, "O Ovo do Lago", "roteiro_gerado", agora);
  inserirCapitulo.run(2, "O Chamado", "roteiro_gerado", agora);
  banco.close();

  const projeto = join(pastaDados, "projetos", "leo-e-o-dragao");
  const versao = (n: number) => JSON.stringify({ versao: n, criadoEm: agora, instrucao: "", palavras: 10 });
  mkdirSync(join(projeto, "capitulos", "001", "versoes"), { recursive: true });
  mkdirSync(join(projeto, "capitulos", "002", "versoes"), { recursive: true });
  writeFileSync(join(projeto, "dossie.json"), JSON.stringify({ sinopse: "Léo encontra um ovo." }));
  writeFileSync(join(projeto, "capitulos", "001", "versoes", "roteiro_v1.json"), versao(1));
  writeFileSync(join(projeto, "capitulos", "001", "versoes", "roteiro_v2.json"), versao(2));
  writeFileSync(join(projeto, "capitulos", "002", "versoes", "roteiro_v1.json"), versao(1));
  mkdirSync(join(pastaDados, "lixeira", "teste-antigo"), { recursive: true });
  writeFileSync(join(pastaDados, "lixeira", "teste-antigo", "dossie.json"), "{}");
}
