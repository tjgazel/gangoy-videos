// Adiciona componentes do shadcn-vue em interface/src/components/ui.
// Uso: npm run ui:adicionar -- table dialog
// O CLI só reconhece a pasta se ela tiver um package.json; como o projeto tem um só (na raiz),
// este script cria um provisório em interface/ e o remove no fim, junto com o que o CLI instalar ali.
import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const nomes = process.argv.slice(2);
if (nomes.length === 0) {
  console.error("Informe os componentes. Ex.: npm run ui:adicionar -- table dialog");
  process.exit(2);
}

const pasta = join(import.meta.dirname, "..", "interface");
const provisorios = ["package.json", "package-lock.json", "node_modules"].map((nome) => join(pasta, nome));
writeFileSync(provisorios[0] as string, JSON.stringify({ name: "interface", private: true, type: "module" }));
try {
  const resultado = spawnSync("npx", ["shadcn-vue@latest", "add", ...nomes, "-c", ".", "-y"], {
    cwd: pasta,
    stdio: "inherit",
    shell: true,
  });
  process.exitCode = resultado.status ?? 1;
} finally {
  for (const caminho of provisorios) rmSync(caminho, { recursive: true, force: true });
}
