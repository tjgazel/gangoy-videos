import { test, expect } from "@playwright/test";
import { avisos, projetoComRoteiro } from "./apoio.js";

test("revisão lista o roteiro para aprovar e abre o capítulo", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await projetoComRoteiro(request);
  await page.goto("/revisao");
  const item = page.getByRole("listitem").filter({ hasText: "Cap. 1 · O Ovo do Lago" });
  await expect(item).toContainText("Roteiro para aprovar");
  await item.getByRole("link").click();
  await expect(page).toHaveURL(/\/capitulos\/1$/);
});

test("revisão vazia convida a seguir", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await request.post("/api/projetos", { data: { nome: "Sem nada" } });
  await page.goto("/revisao");
  await expect(page.getByText("Nada esperando por você.")).toBeVisible();
});

test("dossiê por seções; salvar; Ver JSON mostra o erro com o caminho do campo", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  const projetoId = await projetoComRoteiro(request);
  await page.goto("/dossie");
  for (const secao of ["Sinopse", "Mundo", "Personagens", "Fatos", "Fios abertos", "Linha do tempo", "Esboços", "Resumos"]) {
    await expect(page.getByRole("heading", { level: 2, name: secao, exact: true })).toBeVisible();
  }

  const personagem = page.getByRole("group", { name: "Personagem 1" });
  await personagem.getByLabel("Aparência fixa").fill("Menino de 11 anos com chapéu de palha.");
  await page.getByRole("button", { name: "Salvar dossiê" }).click();
  await expect(avisos(page).getByText("Dossiê salvo")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Personagem 1" }).getByLabel("Aparência fixa")).toHaveValue("Menino de 11 anos com chapéu de palha.");

  const dossie = await (await request.get(`/api/projetos/${projetoId}/dossie`)).json();
  delete dossie.personagens[0].nome;
  await page.getByRole("button", { name: "Ver JSON" }).click();
  await page.getByLabel("Dossiê em JSON").fill(JSON.stringify(dossie, null, 2));
  await page.getByRole("button", { name: "Salvar JSON" }).click();
  await expect(page.getByText("Personagens › item 1 › nome: campo obrigatório")).toBeVisible();
});

test("fato adicionado grava o capítulo como número", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  const projetoId = await projetoComRoteiro(request);
  await page.goto("/dossie");
  await page.getByRole("button", { name: "Adicionar fato" }).click();
  const fato = page.getByRole("group", { name: /^Fato \d+$/ }).last();
  await fato.getByLabel("Capítulo").fill("2");
  await fato.getByLabel("O que aconteceu").fill("Léo achou o ovo.");
  await page.getByRole("button", { name: "Salvar dossiê" }).click();
  await expect(avisos(page).getByText("Dossiê salvo")).toBeVisible();
  const dossie = await (await request.get(`/api/projetos/${projetoId}/dossie`)).json();
  expect(dossie.fatos.at(-1)).toEqual({ capitulo: 2, descricao: "Léo achou o ovo." });
});
