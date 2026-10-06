import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
});

test("workspace sem o marcador: faixa 'Workspace não encontrada'", async ({ page, request }) => {
  const status = await (await request.get("/api/sistema/status")).json();
  await request.post("/__teste/estragar-workspace", { data: { remover: "marcador" } });
  await page.goto("/producao");
  await expect(page.getByRole("alert")).toContainText(`Workspace não encontrada em ${status.workspace.caminho}`);
});

test("workspace sem gangoy.db: a faixa explica que falta o banco", async ({ page, request }) => {
  const status = await (await request.get("/api/sistema/status")).json();
  await request.post("/__teste/estragar-workspace", { data: { remover: "banco" } });
  await page.goto("/producao");
  await expect(page.getByRole("alert")).toContainText(
    `A workspace em ${status.workspace.caminho} está sem o arquivo gangoy.db. Restaure-o de um backup ou aponte outro local.`,
  );
  await expect(page.getByRole("link", { name: "Apontar outro local" })).toBeVisible();
});
