import { test, expect } from "@playwright/test";
import { avisos, escolherOpcao, valorDoSeletor } from "./apoio.js";

test("seções visíveis; modelos e contexto salvos; erro do servidor; credenciais", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await page.goto("/configuracoes");
  for (const secao of ["Workspace", "Ollama", "YouTube"]) {
    await expect(page.getByRole("heading", { level: 2, name: secao })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Apagar dados antigos já convertidos" })).toHaveCount(0);

  await escolherOpcao(page, "Modelo principal", "qwen3.6:latest");
  await page.getByLabel("Contexto de trabalho (tokens)").fill("16384");
  await page.getByRole("button", { name: "Salvar modelos" }).click();
  await expect(avisos(page).getByText("Modelos salvos")).toBeVisible();
  await page.reload();
  await expect(valorDoSeletor(page, "Modelo principal")).toContainText("qwen3.6:latest");
  await expect(page.getByLabel("Contexto de trabalho (tokens)")).toHaveValue("16384");

  await page.getByLabel("Contexto de trabalho (tokens)").fill("300000");
  await page.getByRole("button", { name: "Salvar modelos" }).click();
  await expect(page.getByText("O contexto de trabalho máximo é 262.144 tokens")).toBeVisible();

  await page.getByLabel("Client ID").fill("123.apps.googleusercontent.com");
  await page.getByLabel("Client Secret").fill("segredo-de-teste");
  await page.getByRole("button", { name: "Salvar credenciais" }).click();
  await expect(page.getByText("Client Secret salvo")).toBeVisible();
  await expect(page.getByLabel("Client Secret")).toHaveValue("");
});

test("apagar dados antigos já convertidos pede confirmação com nome e tamanho", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true, comDadosAntigos: true } });
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Apagar dados antigos já convertidos" }).click();
  const dialogo = page.getByRole("alertdialog").filter({ hasText: "Apagar dados antigos" });
  await expect(dialogo).toContainText("app.db.migrado");
  await expect(dialogo).toContainText("projetos.migrado");
  await expect(dialogo).toContainText(/KB|bytes/);
  await dialogo.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByRole("button", { name: "Apagar dados antigos já convertidos" })).toHaveCount(0);
});

test("Esc no diálogo de confirmação não apaga nada", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true, comDadosAntigos: true } });
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Apagar dados antigos já convertidos" }).click();
  const dialogo = page.getByRole("alertdialog").filter({ hasText: "Apagar dados antigos" });
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("button", { name: "Apagar dados antigos já convertidos" })).toHaveCount(1);
});

test("o diálogo de apagar mostra um item por linha", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true, comDadosAntigos: true } });
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Apagar dados antigos já convertidos" }).click();
  const descricao = page.getByRole("alertdialog").locator("[data-slot=alert-dialog-description]");
  await expect(descricao).toHaveCSS("white-space", "pre-line");
});

test("avisa quando o modelo leve aceita menos que o contexto de trabalho", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await page.goto("/configuracoes");
  await escolherOpcao(page, "Modelo principal", "gemma4:12b-it-qat");
  await escolherOpcao(page, "Modelo leve", "gemma4:e4b-it-qat");
  await page.getByLabel("Contexto de trabalho (tokens)").fill("200000");
  await expect(page.getByText("O modelo leve aceita até 131.072 tokens: nas chamadas dele o contexto será 131.072.")).toBeVisible();
  await page.getByLabel("Contexto de trabalho (tokens)").fill("100000");
  await expect(page.getByText("O modelo leve aceita até")).toHaveCount(0);
  await expect(page.getByText("Contexto que o app pede ao Ollama em cada chamada, limitado ao máximo de cada modelo")).toBeVisible();
});

test("o cartão Ollama não mostra um contexto padrão (o app do Ollama não o expõe)", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 2, name: "Ollama" })).toBeVisible();
  await expect(page.getByText("Contexto padrão")).toHaveCount(0);
  await expect(page.getByText("Context length")).toHaveCount(0);
});

test("modal explica como criar as credenciais do YouTube no Google Cloud", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await page.goto("/configuracoes");
  const botao = page.getByRole("button", { name: "Como obter as credenciais" });
  expect((await botao.boundingBox())!.width).toBeLessThan(260); // não ocupa a linha inteira
  await botao.click();
  const modal = page.getByRole("dialog", { name: "Como criar as credenciais do YouTube" });
  await expect(modal).toBeVisible();
  for (const texto of ["YouTube Data API v3", "Desktop app", "Usuários de teste", "Client ID", "7 dias", "privados"]) {
    await expect(modal).toContainText(texto);
  }
  // Os passos aparecem numerados (item de lista de verdade, não um grid sem marcador).
  await expect(modal.locator("ol > li").first()).toHaveCSS("display", "list-item");
  await expect(modal.locator("ol > li")).toHaveCount(5);
  // Links oficiais do Google, sempre em outra aba e sem enviar a origem.
  await expect(modal.locator("a[href^='https://developers.google.com/']").first()).toBeVisible();
  await expect(modal.locator("a:not([target=_blank][rel~=noopener][rel~=noreferrer])")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
});

test("Ollama e Modelos são um cartão só, nesta ordem: situação, modelos escolhidos e modelos instalados", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 2, name: "Modelos" })).toHaveCount(0);
  const cartao = page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { level: 2, name: "Ollama" }) });
  await expect(cartao).toHaveCount(1);
  for (const dentro of [
    cartao.getByText("Situação", { exact: true }),
    cartao.getByRole("combobox", { name: "Modelo principal" }),
    cartao.getByRole("combobox", { name: "Modelo leve" }),
    cartao.getByLabel("Contexto de trabalho (tokens)"),
    cartao.getByRole("button", { name: "Salvar modelos" }),
    cartao.getByRole("heading", { level: 3, name: "Modelos instalados" }),
    cartao.getByRole("columnheader", { name: "Contexto máximo" }),
  ]) {
    await expect(dentro).toBeVisible();
  }
  const y = async (alvo: import("@playwright/test").Locator) => (await alvo.boundingBox())!.y;
  const situacao = await y(cartao.getByText("Situação", { exact: true }));
  const escolhidos = await y(cartao.getByRole("combobox", { name: "Modelo principal" }));
  const instalados = await y(cartao.getByRole("heading", { level: 3, name: "Modelos instalados" }));
  expect(situacao).toBeLessThan(escolhidos);
  expect(escolhidos).toBeLessThan(instalados);
});
