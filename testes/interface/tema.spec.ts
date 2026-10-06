import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
});

test("tema escuro por padrão; troca para claro e continua após recarregar", async ({ page }) => {
  await page.goto("/producao");
  await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
  await page.getByRole("button", { name: "☀ Claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "claro");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "claro");
});

test("menu lateral tem Produção, Revisão, Dossiê, Projetos e Configurações", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/producao$/);
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  for (const item of ["Produção", "Revisão", "Dossiê", "Projetos", "Configurações"]) {
    await expect(menu.getByRole("link", { name: item })).toBeVisible();
  }
  await menu.getByRole("link", { name: "Projetos" }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole("heading", { level: 1, name: "Projetos" })).toBeVisible();
});
