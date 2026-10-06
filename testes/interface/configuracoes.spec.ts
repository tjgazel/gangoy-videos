import { test, expect } from "@playwright/test";
import { avisos, escolherOpcao, valorDoSeletor } from "./apoio.js";

test("seções visíveis; modelos e contexto salvos; erro do servidor; credenciais", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await page.goto("/configuracoes");
  for (const secao of ["Workspace", "Modelos", "YouTube", "Ollama"]) {
    await expect(page.getByRole("heading", { level: 2, name: secao })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Apagar dados antigos já convertidos" })).toHaveCount(0);

  await escolherOpcao(page, "Modelo principal", "qwen3.6:latest");
  await page.getByLabel("Contexto de trabalho (tokens)").fill("16384");
  await page.getByRole("button", { name: "Salvar modelos" }).click();
  await expect(avisos(page).getByText("Modelos salvos")).toBeVisible();
  await page.reload();
  await expect(valorDoSeletor(page, "Modelo principal")).toContainText("qwen3.6:latest");
  await expect(page.getByLabel("Contexto de trabalho (tokens)")).toHaveValue("16384");

  await page.getByLabel("Contexto de trabalho (tokens)").fill("300000");
  await page.getByRole("button", { name: "Salvar modelos" }).click();
  await expect(page.getByText("O contexto de trabalho máximo é 262.144 tokens")).toBeVisible();

  await page.getByLabel("Client ID").fill("123.apps.googleusercontent.com");
  await page.getByLabel("Client Secret").fill("segredo-de-teste");
  await page.getByRole("button", { name: "Salvar credenciais" }).click();
  await expect(page.getByText("Client Secret salvo")).toBeVisible();
  await expect(page.getByLabel("Client Secret")).toHaveValue("");
});

test("apagar dados antigos já convertidos pede confirmação com nome e tamanho", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true, comDadosAntigos: true } });
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Apagar dados antigos já convertidos" }).click();
  const dialogo = page.getByRole("alertdialog").filter({ hasText: "Apagar dados antigos" });
  await expect(dialogo).toContainText("app.db.migrado");
  await expect(dialogo).toContainText("projetos.migrado");
  await expect(dialogo).toContainText(/KB|bytes/);
  await dialogo.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByRole("button", { name: "Apagar dados antigos já convertidos" })).toHaveCount(0);
});

test("Esc no diálogo de confirmação não apaga nada", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true, comDadosAntigos: true } });
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Apagar dados antigos já convertidos" }).click();
  const dialogo = page.getByRole("alertdialog").filter({ hasText: "Apagar dados antigos" });
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("button", { name: "Apagar dados antigos já convertidos" })).toHaveCount(1);
});

test("o diálogo de apagar mostra um item por linha", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true, comDadosAntigos: true } });
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Apagar dados antigos já convertidos" }).click();
  const descricao = page.getByRole("alertdialog").locator("[data-slot=alert-dialog-description]");
  await expect(descricao).toHaveCSS("white-space", "pre-line");
});
