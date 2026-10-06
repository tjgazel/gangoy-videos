import { test, expect } from "@playwright/test";

test("planejar pelo formulário, confirmar e gerar roteiro pelo quadro", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await request.post("/api/projetos", { data: { nome: "Léo e o Dragão" } });

  await page.goto("/producao");
  await page.getByRole("link", { name: "Planejar história" }).click();
  await expect(page).toHaveURL(/\/producao\/planejamento$/);
  await page.getByLabel("Enredo").fill("Léo encontra um ovo de dragão e salva a vila da seca.");
  await page.getByRole("button", { name: "Propor planejamento" }).click();

  await expect(page.getByLabel("Sinopse")).toHaveValue(/Léo encontra um ovo mágico/);
  await expect(page.getByRole("group", { name: /^Personagem \d$/ })).toHaveCount(2);
  await expect(page.getByRole("group", { name: /^Capítulo \d$/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Remover capítulo 3" }).click();
  await expect(page.getByRole("group", { name: /^Capítulo \d$/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Confirmar planejamento" }).click();

  await expect(page).toHaveURL(/\/producao$/);
  const planejado = page.getByRole("region", { name: "Planejado" });
  await expect(planejado.getByRole("article")).toHaveCount(2);

  await request.post("/__teste/ollama", { data: { atrasoMs: 2500 } });
  await planejado.getByRole("article").filter({ hasText: "Cap. 1" }).getByRole("button", { name: "Gerar roteiro" }).click();
  const roteiro = page.getByRole("region", { name: "Roteiro", exact: true });
  const cartao = roteiro.getByRole("article").filter({ hasText: "Cap. 1" });
  await expect(cartao.getByRole("progressbar")).toBeVisible();
  await expect(cartao).toContainText("Aguardando aprovação", { timeout: 10000 });
  await expect(planejado.getByRole("article")).toHaveCount(1);
});
