import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
});

test("cartão avisa quando o modelo do projeto não está instalado", async ({ page, request }) => {
  await request.post("/api/projetos", { data: { nome: "Antigo", modeloOllama: "llama9" } });
  await page.goto("/projetos");
  await expect(page.getByText("Modelo não instalado: llama9")).toBeVisible();
});

test("criar, editar, validar e excluir projeto", async ({ page }) => {
  await page.goto("/projetos");
  await page.getByRole("button", { name: "Novo projeto" }).click();
  const painel = page.getByRole("dialog", { name: "Novo projeto" });
  await painel.getByLabel("Nome do projeto").fill("Fábulas");
  await painel.getByRole("button", { name: "Criar projeto" }).click();

  const cartao = page.getByRole("article").filter({ hasText: "Fábulas" });
  await expect(cartao).toBeVisible();
  await expect(cartao.getByTestId("inicial")).toHaveText("F");
  await expect(cartao).toContainText("Padrão do sistema");

  await cartao.getByRole("button", { name: "Editar" }).click();
  const edicao = page.getByRole("dialog", { name: "Editar projeto" });
  await edicao.getByLabel("Duração padrão (minutos)").fill("12");
  await edicao.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(edicao.getByText("A duração máxima é 10 minutos")).toBeVisible();
  await edicao.getByLabel("Duração padrão (minutos)").fill("6");
  await edicao.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(edicao).toBeHidden();
  await expect(cartao).toContainText("6 min");

  await cartao.getByRole("button", { name: "Excluir" }).click();
  const dialogo = page.getByRole("alertdialog").filter({ hasText: "Excluir o projeto" });
  await expect(dialogo).toContainText("A pasta do projeto vai para a lixeira da workspace (.lixeira) e pode ser recuperada.");
  await dialogo.getByRole("button", { name: "Excluir projeto" }).click();
  await expect(cartao).toBeHidden();
  await expect(page.getByText("Nenhum projeto ainda.")).toBeVisible();
});

test("Esc fecha o painel lateral", async ({ page }) => {
  await page.goto("/projetos");
  await page.getByRole("button", { name: "Novo projeto" }).click();
  const painel = page.getByRole("dialog", { name: "Novo projeto" });
  await expect(painel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(painel).toBeHidden();
});
