import { defineConfig } from "@playwright/test";

// Testes de interface com o Google Chrome instalado no sistema (nenhum navegador é baixado).
export default defineConfig({
  testDir: "testes/interface",
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    channel: "chrome",
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run construir:interface && npx tsx scripts/servidorTeste.ts",
    url: "http://127.0.0.1:3100/api/configuracoes/app",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
