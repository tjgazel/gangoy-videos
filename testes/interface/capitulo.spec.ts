import { test, expect } from "@playwright/test";
import { escolherOpcao, projetoComRoteiro } from "./apoio.js";

test("cenas, versões, refazer com outro modelo, continuidade e aprovação com seleção", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  const projetoId = await projetoComRoteiro(request);

  await page.goto("/capitulos/1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cap. 1 · O Ovo do Lago");
  const cenas = page.getByRole("list", { name: "Cenas" }).getByRole("listitem");
  await expect(cenas).toHaveCount(8);
  await expect(cenas.first()).toContainText("Na cena 1, Léo caminhou");
  await expect(cenas.first()).toContainText("Léo, Brisa");
  await expect(cenas.first()).toContainText("Léo e Brisa na beira do lago seco");
  await expect(page.getByText("Duração estimada: 8 min de 8 min")).toBeVisible();
  await expect(page.getByLabel("Versão")).toContainText(/v1 · gemma4:12b-it-qat · [\d,]+ s · Contexto: \d+% \([\d.]+ de 32\.768\)/);

  await page.getByLabel("O que corrigir").fill("Brisa precisa aparecer mais");
  await escolherOpcao(page, "Gerar com", "qwen3.6:latest");
  await page.getByRole("button", { name: "Refazer com esta instrução" }).click();
  await expect(page.getByLabel("Versão")).toHaveValue("2", { timeout: 10000 });
  await expect(page.getByLabel("Versão")).toContainText("v2 · qwen3.6:latest");

  await page.getByRole("button", { name: "Verificar continuidade" }).click();
  await expect(page.getByText("Nenhum problema encontrado")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Aprovar roteiro" }).click();
  const fato = page.getByRole("checkbox", { name: "Brisa nasce do ovo encontrado no lago." });
  await expect(fato).toBeChecked({ timeout: 10000 });
  await fato.uncheck();
  await page.getByRole("button", { name: "Confirmar aprovação" }).click();
  await expect(page.getByText("Roteiro aprovado", { exact: true }).first()).toBeVisible();
  const dossie = await (await request.get(`/api/projetos/${projetoId}/dossie`)).json();
  expect(dossie.fatos.map((f: { descricao: string }) => f.descricao)).not.toContain("Brisa nasce do ovo encontrado no lago.");
  expect(dossie.resumosCapitulos[0].numero).toBe(1);
});

test("versão com possível corte de contexto mostra alerta", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await request.post("/__teste/ollama", { data: { promptEvalCount: 32768 - 6000 } });
  await projetoComRoteiro(request);
  await page.goto("/capitulos/1");
  await expect(page.getByText("Possível corte de contexto nesta versão")).toBeVisible();
  await expect(page.getByLabel("Versão")).toContainText("Contexto: 82% (26.768 de 32.768)");
});

test("versão gerada com parte do modelo na CPU mostra o aviso", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await request.post("/__teste/ollama", { data: { gpuParcial: true } });
  await projetoComRoteiro(request);
  await page.goto("/capitulos/1");
  await expect(page.getByText("gemma4:12b-it-qat: 30% na CPU (mais lento). Reduza o contexto ou use um modelo menor.")).toBeVisible();
});
