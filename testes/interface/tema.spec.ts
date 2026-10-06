import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
});

test("tema escuro por padrão; troca para claro e continua após recarregar", async ({ page }) => {
  await page.goto("/producao");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Tema" }).click();
  await page.getByRole("menuitem", { name: "Claro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("tema Sistema segue o esquema de cores do navegador", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/producao");
  await page.getByRole("button", { name: "Tema" }).click();
  await page.getByRole("menuitem", { name: "Sistema" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("preferência antiga 'claro' é respeitada", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gangoy.tema", "claro"));
  await page.goto("/producao");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("gangoy.tema"))).toBe("light");
});

test("preferência antiga 'escuro' é respeitada", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gangoy.tema", "escuro"));
  await page.goto("/producao");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("gangoy.tema"))).toBe("dark");
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
