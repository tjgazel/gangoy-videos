import { test, expect } from "@playwright/test";
import { avisos } from "./apoio.js";

test.beforeEach(async ({ request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
});

test("só a área de conteúdo rola", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 500 });
  await page.goto("/configuracoes");
  const conteudo = page.getByTestId("conteudo");
  await expect(conteudo).toBeVisible();
  const rolou = await conteudo.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop;
  });
  expect(rolou).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0);
  expect((await page.locator("header").first().boundingBox())?.y).toBe(0);
});

test("janela estreita: o menu abre pelo gatilho", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/producao");
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await expect(menu).toHaveCount(0);
  await page.getByRole("button", { name: "Alternar barra lateral" }).click();
  await expect(menu.getByRole("link", { name: "Projetos" })).toBeVisible();
  await menu.getByRole("link", { name: "Projetos" }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(menu).toHaveCount(0);
});

test("a barra lateral recolhe para ícones e o menu continua com nomes acessíveis", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/producao");
  await page.getByRole("button", { name: "Alternar barra lateral" }).click();
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  for (const item of ["Produção", "Revisão", "Dossiê", "Projetos", "Configurações"]) {
    await expect(menu.getByRole("link", { name: item })).toBeVisible();
  }
  await expect(page.locator("[data-slot=sidebar]").first()).toHaveAttribute("data-state", "collapsed");
});

test("avisos aparecem dentro da janela, não abaixo da página", async ({ page }) => {
  await page.goto("/projetos");
  await page.getByRole("button", { name: "Novo projeto" }).click();
  await page.getByLabel("Nome do projeto").fill("Fábulas");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(avisos(page).getByText("Projeto criado")).toBeInViewport();
});

test("a interface não faz requisições para fora da máquina", async ({ page }) => {
  const externas: string[] = [];
  page.on("request", (requisicao) => {
    const { protocol, hostname } = new URL(requisicao.url());
    if (protocol.startsWith("http") && hostname !== "127.0.0.1" && hostname !== "localhost") externas.push(requisicao.url());
  });
  await page.goto("/producao");
  await page.waitForLoadState("networkidle");
  expect(externas).toEqual([]);
});
