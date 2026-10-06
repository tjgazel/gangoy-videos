import { test, expect } from "@playwright/test";
import { join } from "node:path";

test("sem workspace: escolhe a pasta, cria 'Meus Vídeos' e começa a usar", async ({ page, request }) => {
  const { local } = await (await request.post("/__teste/reiniciar", { data: { comWorkspace: false } })).json();

  await page.goto("/producao");
  await expect(page).toHaveURL(/\/boas-vindas$/);
  await expect(page.getByText("Evite pastas de rede (compartilhamentos do Windows, NAS): o banco de dados pode corromper.")).toBeVisible();

  await page.getByLabel("Caminho da pasta").fill(local);
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await page.getByRole("button", { name: "Nova pasta" }).click();
  await page.getByLabel("Nome da nova pasta").fill("Meus Vídeos");
  await page.getByRole("button", { name: "Criar pasta" }).click();
  await page.getByRole("button", { name: "Meus Vídeos" }).click();
  await expect(page.getByTestId("caminho-atual")).toHaveText(join(local, "Meus Vídeos"));

  await page.getByRole("button", { name: "Usar esta pasta" }).click();
  await expect(page).toHaveURL(/\/producao$/);
  const status = await (await request.get("/api/sistema/status")).json();
  expect(status.workspace.caminho).toBe(join(local, "Meus Vídeos", "Gangoy-workspace"));
  await expect(page.getByLabel("Workspace disponível")).toBeVisible();
});

test("caminho inexistente mostra o erro do servidor", async ({ page, request }) => {
  const { local } = await (await request.post("/__teste/reiniciar", { data: { comWorkspace: false } })).json();
  await page.goto("/boas-vindas");
  await page.getByLabel("Caminho da pasta").fill(join(local, "nao-existe"));
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(page.getByText("Pasta não encontrada")).toBeVisible();
});

test("depois de criar a workspace, a fila atualiza ao vivo sem recarregar a página", async ({ page, request }) => {
  const { local } = await (await request.post("/__teste/reiniciar", { data: { comWorkspace: false } })).json();
  await page.goto("/boas-vindas");
  await page.getByLabel("Caminho da pasta").fill(local);
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await page.getByRole("button", { name: "Usar esta pasta" }).click();
  await expect(page).toHaveURL(/\/producao$/);

  await request.post("/__teste/ollama", { data: { atrasoMs: 3000 } });
  const projeto = await (await request.post("/api/projetos", { data: { nome: "Ao vivo" } })).json();
  await request.post(`/api/projetos/${projeto.id}/planejamento`, { data: { enredo: "Léo encontra um ovo de dragão e salva a vila da seca." } });
  await expect(page.getByRole("button", { name: /Fila: 1 executando/ })).toBeVisible({ timeout: 8000 });
});
