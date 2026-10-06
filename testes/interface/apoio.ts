import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

// Espera uma tarefa terminar consultando a API (os testes de interface não assinam o SSE).
export async function esperarTarefa(request: APIRequestContext, tarefaId: number) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    const tarefa = await (await request.get(`/api/tarefas/${tarefaId}`)).json();
    if (["concluida", "falhou", "cancelada"].includes(tarefa.status)) return tarefa;
    await new Promise((pronto) => setTimeout(pronto, 100));
  }
  throw new Error(`A tarefa ${tarefaId} não terminou`);
}

// Projeto com planejamento confirmado e o roteiro do capítulo 1 gerado.
export async function projetoComRoteiro(request: APIRequestContext): Promise<number> {
  const projeto = await (await request.post("/api/projetos", { data: { nome: "Léo e o Dragão" } })).json();
  const plano = await (
    await request.post(`/api/projetos/${projeto.id}/planejamento`, {
      data: { enredo: "Léo encontra um ovo de dragão e salva a vila da seca." },
    })
  ).json();
  const proposta = await esperarTarefa(request, plano.tarefaId);
  expect((await request.post(`/api/projetos/${projeto.id}/planejamento/confirmar`, { data: proposta.resultado })).ok()).toBe(true);
  const roteiro = await (await request.post(`/api/projetos/${projeto.id}/capitulos/1/roteiro`)).json();
  expect((await esperarTarefa(request, roteiro.tarefaId)).status).toBe("concluida");
  return projeto.id;
}

// Os seletores do shadcn-vue não são <select> nativos: abre o combobox pelo nome e clica na opção.
export async function escolherOpcao(page: Page, rotulo: string | RegExp, opcao: string | RegExp): Promise<void> {
  await page.getByRole("combobox", { name: rotulo }).click();
  await page.getByRole("option", { name: opcao }).click();
}

// O texto do valor escolhido, para asserções como toHaveText.
export function valorDoSeletor(page: Page, rotulo: string | RegExp): Locator {
  return page.getByRole("combobox", { name: rotulo });
}

// Região de avisos (toasts) do vue-sonner, rotulada em Aviso.vue.
export function avisos(page: Page): Locator {
  return page.getByRole("region", { name: /^Avisos/ });
}
