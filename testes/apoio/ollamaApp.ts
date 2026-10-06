import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Imita a pasta do app do Ollama no Windows: db.sqlite (slider "Context length") e server.log
// (linha "server config" do servidor que está rodando).
export function gravarBancoOllamaApp(pasta: string, contextoConfigurado: number): void {
  const banco = new DatabaseSync(join(pasta, "db.sqlite"));
  banco.exec("CREATE TABLE settings (id INTEGER PRIMARY KEY, device_id TEXT, context_length INTEGER)");
  banco.prepare("INSERT INTO settings (device_id, context_length) VALUES (?, ?)").run("dispositivo", contextoConfigurado);
  banco.close();
}

export function gravarLogOllamaApp(pasta: string, contextoEmVigor: number): void {
  const linha = `time=2026-10-06T19:59:00.511-03:00 level=INFO source=routes.go:23 msg="server config" env="map[OLLAMA_CONTEXT_LENGTH:${contextoEmVigor} OLLAMA_HOST:http://127.0.0.1:11434]"\n`;
  writeFileSync(join(pasta, "server.log"), `${linha}time=2026-10-06T19:59:01.000-03:00 level=INFO msg="outra coisa"\n`);
}
