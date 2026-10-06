import { test, expect, type APIRequestContext } from "@playwright/test";

const ENREDO = "Léo encontra um ovo de dragão e salva a vila da seca.";

async function enfileirarPlanejamento(request: APIRequestContext): Promise<number> {
  const projeto = await (await request.post("/api/projetos", { data: { nome: `Fila ${Date.now()}` } })).json();
  const resposta = await request.post(`/api/projetos/${projeto.id}/planejamento`, { data: { enredo: ENREDO } });
  expect(resposta.status()).toBe(202);
  return projeto.id;
}

test.beforeEach(async ({ request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
});

test("indicador mostra 'Fila: 1 executando · 0 aguardando' durante uma tarefa", async ({ page, request }) => {
  await request.post("/__teste/ollama", { data: { atrasoMs: 4000 } });
  await enfileirarPlanejamento(request);
  await page.goto("/producao");
  await expect(page.getByRole("button", { name: /Fila: 1 executando · 0 aguardando/ })).toBeVisible();
});

test("recarregar a página com tarefa em execução mantém o indicador", async ({ page, request }) => {
  await request.post("/__teste/ollama", { data: { atrasoMs: 5000 } });
  await enfileirarPlanejamento(request);
  await page.goto("/producao");
  await expect(page.getByRole("button", { name: /Fila: 1 executando/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Fila: 1 executando/ })).toBeVisible();
});

test("aviso 'Tarefa concluída' ao terminar", async ({ page, request }) => {
  await request.post("/__teste/ollama", { data: { atrasoMs: 1200 } });
  await page.goto("/producao");
  await expect(page.getByRole("button", { name: /Fila: 0 executando · 0 aguardando/ })).toBeVisible();
  await enfileirarPlanejamento(request);
  await expect(page.getByRole("status").filter({ hasText: "Tarefa concluída" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: /Fila: 0 executando/ })).toBeVisible();
});

test("status do Ollama aparece com título 'Ollama online'", async ({ page }) => {
  await page.goto("/producao");
  await expect(page.getByLabel("Ollama online")).toBeVisible();
  await expect(page.getByLabel("Workspace disponível")).toBeVisible();
});

test("sem workspace, qualquer tela leva às boas-vindas", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: false } });
  await page.goto("/projetos");
  await expect(page).toHaveURL(/\/boas-vindas$/);
});
