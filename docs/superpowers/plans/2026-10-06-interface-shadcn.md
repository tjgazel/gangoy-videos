# Interface com shadcn-vue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a base visual da interface Vue pelo shadcn-vue (Tailwind v4 e Reka UI), com tema claro/escuro, ícones Lucide, shell fixo no estilo `dashboard-01` e as 8 telas migradas.

**Architecture:** O CLI do shadcn-vue gera os componentes em `interface/src/components/ui/` (nunca editados à mão); o shell, o tema e as telas os compõem por classes do Tailwind. O CSS antigo (`temas.css`, `base.css`) convive com o novo até a última tarefa, quando é removido. O comportamento e os textos de cada tela não mudam.

**Tech Stack:** Vue 3, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn-vue, Reka UI, `lucide-vue-next`, `@vueuse/core`, `vue-sonner`, Playwright (Chrome do sistema).

**Spec:** `docs/superpowers/specs/2026-10-06-interface-shadcn-design.md`

## Global Constraints

- Servidor, API, banco e regras de negócio não mudam; nenhuma funcionalidade nova entra.
- Os arquivos de `interface/src/components/ui/` são gerados pelo CLI e **não são editados à mão**.
- Cores, espaçamento e componentes são os padrão do shadcn-vue: estilo padrão do CLI, base de cor `neutral`, sem paleta própria.
- Textos da interface continuam em português, escritos direto nos componentes, com acentuação correta.
- Tema: `useColorMode` do `@vueuse/core`, classe `dark` no `<html>`, opções Claro, Escuro e Sistema, **padrão Escuro**, preferência na chave `gangoy.tema` do `localStorage`; os valores antigos `escuro` e `claro` são convertidos.
- Menu principal com `aria-label="Menu principal"` e links Produção, Revisão, Dossiê, Projetos, Configurações; ícones: `Clapperboard`, `ClipboardCheck`, `BookOpen`, `FolderKanban`, `Settings`.
- Só a área de conteúdo rola; barra lateral e cabeçalho ficam parados.
- Nenhum teste é removido ou enfraquecido: se um seletor deixa de existir, o teste é reescrito para verificar o mesmo comportamento.
- Ao fim de **cada** tarefa: `npm run verificar` e `npm run teste:interface` verdes, depois o commit. Mensagens de commit em português, terminando com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Trabalho na branch `layout-dashboard`; nada é enviado ao GitHub sem pedido do usuário.
- Durante a migração, o *preflight* do Tailwind pode alterar de leve o visual das telas ainda não migradas; isso é esperado e some quando a tela é migrada. Os testes são semânticos e continuam valendo.

## Review Focus

1. Janela estreita (menos de 768 px): a barra lateral vira gaveta e o menu continua acessível pelo gatilho. Teste na Tarefa 3.
2. Conteúdo longo: ao rolar a área de conteúdo, o cabeçalho continua visível e a página em si não rola. Teste na Tarefa 3.
3. Tema "Sistema": segue `prefers-color-scheme` e a escolha continua após recarregar. Teste na Tarefa 2.
4. Preferência antiga (`gangoy.tema = "claro"`) é respeitada depois da troca. Teste na Tarefa 2.
5. Teclado: `Esc` fecha o painel lateral e o diálogo de confirmação, e o `Esc` num diálogo de confirmação **não** executa a ação. Testes na Tarefa 4.

## Decisões do plano sobre a spec

Estas quatro diferem da tabela da spec por causa dos testes e da estrutura reais; a spec foi ajustada para bater (commit da Tarefa 1):

- **Projetos** continua como grade de `Card` (cada cartão tem ações e é consultado como `article`); `Table` entra só em Configurações.
- **Dossiê e Configurações** usam `Card` empilhado com `Separator`, não `Tabs`: o teste exige que o título de cada seção esteja visível ao mesmo tempo.
- Os pontos de status do cabeçalho usam `Tooltip` e `aria-label` no lugar de `title` (um `title` junto com o `Tooltip` mostraria duas dicas).
- Os `Select` do shadcn-vue não são nativos; os testes ganham o auxiliar `escolherOpcao` em `testes/interface/apoio.ts`.

## Estrutura de arquivos

- `interface/components.json` — configuração do CLI.
- `interface/src/components/ui/**` — gerado pelo CLI.
- `interface/src/lib/utils.ts` — `cn()`, gerado pelo CLI.
- `interface/src/estilos/global.css` — `@import "tailwindcss"` e variáveis do shadcn (gerado).
- `interface/src/estado/usarModoTema.ts` — tema (substitui `usarTema.ts`).
- `interface/src/estado/compatTema.ts` — ponte temporária `dark` → `data-tema`, apagada na Tarefa 13.
- `interface/src/componentes/ModoTema.vue` — menu de troca (substitui `TrocaTema.vue`).
- `interface/src/componentes/MenuApp.vue` — barra lateral (substitui `MenuLateral.vue`).
- `interface/src/componentes/CabecalhoApp.vue` — cabeçalho (substitui `BarraTopo.vue`).
- `testes/interface/shell.spec.ts` — testes do shell (novo).

---

### Task 1: Fundação (Tailwind, alias, CLI, componentes-base)

**Files:**
- Modify: `package.json`, `package-lock.json`, `interface/vite.config.ts`, `interface/tsconfig.json`, `interface/src/main.ts`, `docs/superpowers/specs/2026-10-06-interface-shadcn-design.md`
- Create: `interface/components.json`, `interface/src/lib/utils.ts`, `interface/src/estilos/global.css`, `interface/src/components/ui/**`, `interface/src/estado/compatTema.ts`

**Interfaces:**
- Produces: alias `@/` → `interface/src`; `cn(...classes): string` em `@/lib/utils`; componentes em `@/components/ui/<nome>` para: `button card input textarea label select badge alert progress separator table scroll-area skeleton tooltip dropdown-menu popover sheet sidebar alert-dialog sonner`; classe `dark` no `<html>` passa a existir (Tarefa 2) e `compatTema` espelha em `data-tema`.

- [ ] **Step 1: Guardar a Fase 1 do opencode e partir do commit limpo**

Run: `git stash push -m "fase1-opencode" -- interface/src` (as mudanças de `base.css`, `App.vue`, `BarraTopo.vue`, `MenuLateral.vue` e `TelaCapitulo.vue` ficam guardadas; o shell novo da Tarefa 3 as substitui).
Expected: `git status --short` mostra só `?? .opencode/`.

- [ ] **Step 2: Instalar as dependências**

Run: `npm install tailwindcss @tailwindcss/vite lucide-vue-next @vueuse/core` e `npm install -D @types/node` se ainda não estiver presente.
Expected: instala sem erro; `package.json` lista as novas dependências.

- [ ] **Step 3: Configurar o Vite e o TypeScript**

Em `interface/vite.config.ts`, adicionar `tailwindcss()` aos `plugins` e `resolve.alias["@"]` apontando para `fileURLToPath(new URL("./src", import.meta.url))`. Em `interface/tsconfig.json`, adicionar `"baseUrl": "."` e `"paths": { "@/*": ["./src/*"] }`.

- [ ] **Step 4: Inicializar o shadcn-vue**

Run: `npx shadcn-vue@latest init --cwd interface` com as respostas: estilo padrão do CLI, base de cor `neutral`, CSS em `src/estilos/global.css`, variáveis CSS ligadas, ícones Lucide, aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/composables`, `@/lib`.
Expected: cria `interface/components.json`, `interface/src/lib/utils.ts` e `interface/src/estilos/global.css`, e instala `reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`.
Se o CLI recusar a pasta por não achar `package.json` nela, criar `interface/components.json` à mão com `style` padrão, `typescript: true`, `tailwind: { config: "", css: "src/estilos/global.css", baseColor: "neutral", cssVariables: true, prefix: "" }`, `aliases` acima e `iconLibrary: "lucide"`, criar `src/lib/utils.ts` com `cn()` (`twMerge(clsx(inputs))`), e instalar à mão as dependências listadas.

- [ ] **Step 5: Adicionar os componentes-base**

Run: `npx shadcn-vue@latest add button card input textarea label select badge alert progress separator table scroll-area skeleton tooltip dropdown-menu popover sheet sidebar alert-dialog sonner --cwd interface`
Expected: arquivos em `interface/src/components/ui/`; nenhum erro. Se o CLI perguntar sobre sobrescrever, responder que não.

- [ ] **Step 6: Carregar o CSS novo e criar a ponte de tema**

Em `interface/src/main.ts`, importar `./estilos/global.css` **antes** de `temas.css` e `base.css`. Criar `interface/src/estado/compatTema.ts`, que observa a classe `dark` do `<html>` (via `MutationObserver`) e grava `document.documentElement.dataset.tema` como `"escuro"` ou `"claro"`; importá-lo em `main.ts`. É temporário: as telas antigas ainda leem `[data-tema]`.

- [ ] **Step 7: Ajustar a spec às decisões do plano**

Em `docs/superpowers/specs/2026-10-06-interface-shadcn-design.md`, alterar a tabela da Seção 6 (listas de projetos e capítulos → grade de `Card` em Projetos e `Table` só em Configurações; seções do dossiê e das configurações → `Card` com `Separator`, sem `Tabs`) e a linha do `Tooltip` na Seção 5 (usa `aria-label`, não `title`). Registrar na Seção 8 o auxiliar `escolherOpcao`.

- [ ] **Step 8: Verificar que nada quebrou**

Run: `npm run verificar` e `npm run teste:interface`
Expected: `verificar` sem erros; `23 passed`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json interface docs/superpowers/specs
git commit -m "Base do shadcn-vue: Tailwind v4, alias @/ e componentes-base

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tema claro, escuro e do sistema

**Files:**
- Create: `interface/src/estado/usarModoTema.ts`, `interface/src/componentes/ModoTema.vue`
- Modify: `testes/interface/tema.spec.ts`, `interface/src/estado/compatTema.ts` (só se a ordem de carga exigir)
- Delete (nesta tarefa): nenhum — `usarTema.ts` e `TrocaTema.vue` saem na Tarefa 3, quando o shell deixa de usá-los.

**Interfaces:**
- Produces: `usarModoTema(): { modo: Ref<"light" | "dark" | "auto"> }` (de `useColorMode`, `storageKey: "gangoy.tema"`, `initialValue: "dark"`, `emitAuto: true`); `migrarTemaAntigo(): void` chamada **antes** do primeiro uso (converte `"escuro"`→`"dark"` e `"claro"`→`"light"` em `localStorage["gangoy.tema"]`); componente `ModoTema` (sem props), um `DropdownMenu` cujo gatilho tem `aria-label="Tema"` e itens "Claro", "Escuro", "Sistema".

- [ ] **Step 1: Reescrever os testes de tema (devem falhar)**

Em `testes/interface/tema.spec.ts`, manter o segundo teste (menu) e substituir o primeiro por quatro, todos após `reiniciar`:
- `tema escuro por padrão; troca para claro e continua após recarregar`: `html` tem classe `dark`; abrir `getByRole("button", { name: "Tema" })`, clicar no item `Claro`; `html` sem classe `dark`; após `page.reload()`, continua sem `dark`.
- `tema Sistema segue o esquema de cores do navegador`: `page.emulateMedia({ colorScheme: "light" })`, escolher `Sistema`, `html` sem `dark`; `page.emulateMedia({ colorScheme: "dark" })`, `html` com `dark`.
- `preferência antiga "claro" é respeitada`: `page.addInitScript(() => localStorage.setItem("gangoy.tema", "claro"))`, abrir `/producao`, `html` sem `dark`.
- `preferência antiga "escuro" é respeitada`: idem com `"escuro"`, `html` com `dark`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run teste:interface -- testes/interface/tema.spec.ts`
Expected: FAIL (não há botão "Tema"; `html` não tem a classe).

- [ ] **Step 3: Implementar `usarModoTema.ts` e `ModoTema.vue`**

`usarModoTema` cria o estado compartilhado uma vez por módulo, com a migração executada antes de `useColorMode`. `ModoTema.vue` usa `DropdownMenu`, `DropdownMenuTrigger` (um `Button` `variant="ghost"` ou `outline` com os ícones `Sun`/`Moon`, que alternam por `dark:`), e três `DropdownMenuItem` com `Sun`, `Moon` e `Monitor`, que atribuem `modo.value`. Por enquanto, montar `<ModoTema />` em `App.vue` dentro de um contêiner fixo no canto inferior esquerdo, só para os testes (a Tarefa 3 o move para a barra lateral).

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run teste:interface -- testes/interface/tema.spec.ts`
Expected: PASS nos 5 testes.

- [ ] **Step 5: Suíte completa e commit**

Run: `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add interface testes
git commit -m "Tema claro, escuro e do sistema com useColorMode

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shell (barra lateral, cabeçalho, rolagem só no conteúdo)

**Files:**
- Create: `interface/src/componentes/MenuApp.vue`, `interface/src/componentes/CabecalhoApp.vue`, `testes/interface/shell.spec.ts`
- Modify: `interface/src/App.vue`, `interface/src/componentes/SeletorProjeto.vue`, `interface/src/componentes/IndicadorFila.vue`, `testes/interface/apoio.ts`, `testes/interface/fila.spec.ts`
- Delete: `interface/src/componentes/MenuLateral.vue`, `interface/src/componentes/BarraTopo.vue`, `interface/src/componentes/TrocaTema.vue`, `interface/src/estado/usarTema.ts`

**Interfaces:**
- Consumes: `usarModoTema`/`ModoTema` (Tarefa 2); `usarStatusSistema().status`, `usarProjetoAtual()` (`projetos`, `projetoAtualId`) e `usarTarefas()` (`executando`, `aguardando`, `tarefas`), todos já existentes.
- Produces: em `testes/interface/apoio.ts`, `escolherOpcao(page: Page, rotulo: string | RegExp, opcao: string | RegExp): Promise<void>` (clica no `combobox` de nome `rotulo` e depois no `option` de nome `opcao`) e `valorDoSeletor(page: Page, rotulo: string | RegExp): Locator` (o `combobox` pelo nome, para `toHaveText`); `App.vue` com `SidebarProvider`, `Sidebar collapsible="icon"` (`MenuApp`) e `SidebarInset` (`CabecalhoApp`, faixa de workspace ausente e o `div` de conteúdo), com `RouterView` direto quando a rota é `/boas-vindas`.

- [ ] **Step 1: Escrever os testes do shell e ajustar os da fila (devem falhar)**

Em `testes/interface/shell.spec.ts` (com `reiniciar` com workspace no `beforeEach`, como os demais): 
- `só a área de conteúdo rola`: em `/configuracoes`, rolar `getByTestId("conteudo")` até o fim (`evaluate`); `page.locator("header").first()` continua com `boundingBox().y === 0`, e `document.scrollingElement.scrollTop` é `0`.
- `janela estreita: o menu abre pelo gatilho`: `setViewportSize({ width: 600, height: 800 })`, o link "Projetos" não está visível; clicar em `getByRole("button", { name: "Alternar barra lateral" })` torna `getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Projetos" })` visível.
- `a barra lateral recolhe para ícones e o menu continua com nomes acessíveis`: clicar no gatilho em janela larga; os cinco links continuam acessíveis por nome.
Em `fila.spec.ts`, trocar `getByTitle("Ollama online")` por `getByLabel("Ollama online")`; o botão da fila mantém o nome `/Fila: 1 executando/`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run teste:interface -- testes/interface/shell.spec.ts testes/interface/fila.spec.ts`
Expected: FAIL (sem barra lateral nova, sem "Alternar barra lateral", sem `header`).

- [ ] **Step 3: Implementar `MenuApp.vue`**

Sobre `Sidebar`, `SidebarHeader` (marca "Gangoy Vídeos" com um ícone), `SidebarContent` com `SidebarGroup`/`SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton as-child` envolvendo `RouterLink`, e `SidebarFooter` com `ModoTema`. O `SidebarMenu` fica dentro de um `<nav aria-label="Menu principal">`; o item ativo usa `:is-active` pela rota. Ícones e nomes na tabela das Global Constraints.

- [ ] **Step 4: Implementar `CabecalhoApp.vue`, `SeletorProjeto.vue` e `IndicadorFila.vue`**

`CabecalhoApp.vue` é um `<header>` com `SidebarTrigger` (nome acessível "Alternar barra lateral"), `SeletorProjeto`, espaço flexível, `IndicadorFila` e dois pontos de status (`Tooltip`, cada um com `aria-label` "Ollama online" / "Ollama fora do ar" / "Workspace disponível" / "Workspace não encontrada", mesmas condições de hoje, e ícones `Cpu` e `HardDrive` coloridos por estado). `SeletorProjeto` vira `Select` com `aria-label="Projeto"` (mantendo o link "Criar o primeiro projeto" quando não há projetos). `IndicadorFila` vira `Popover`: o gatilho é um `Button` com o texto atual "Fila: N executando · M aguardando"; o conteúdo mantém `role="dialog"` e `aria-label="Fila de tarefas"` e a lista de tarefas com `Badge` de estado, `Progress` e os botões Cancelar e Tentar de novo.

- [ ] **Step 5: Implementar `App.vue`**

Estrutura da Seção 5 da spec. `SidebarInset` (que já renderiza um `<main>`) ocupa a altura da janela (`h-svh`, `overflow-hidden`, em coluna); a área de rolagem é um `<div data-testid="conteudo" class="flex-1 overflow-y-auto p-4 md:p-6">` dentro dele, sem um segundo `<main>`. A faixa de workspace ausente vira `Alert` `variant="destructive"` com os mesmos textos e botões ("Tentar de novo", "Apontar outro local") e `role="alert"`. Remover o contêiner provisório de `ModoTema` da Tarefa 2. Apagar os quatro arquivos listados em *Delete*. Atualizar `apoio.ts` com os dois auxiliares.

- [ ] **Step 6: Rodar e ver passar**

Run: `npm run teste:interface -- testes/interface/shell.spec.ts testes/interface/fila.spec.ts testes/interface/tema.spec.ts testes/interface/workspaceAusente.spec.ts`
Expected: PASS.

- [ ] **Step 7: Suíte completa e commit**

Run: `npm run verificar` e `npm run teste:interface`
Expected: `verificar` limpo; todos os testes passam (pontos de `selectOption` de outras telas ainda usam `<select>` nativo por enquanto, então continuam válidos).

```bash
git add -A interface testes
git commit -m "Shell com barra lateral recolhível, cabeçalho e rolagem só no conteúdo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Componentes compartilhados (avisos, confirmação, painel, progresso)

**Files:**
- Modify: `interface/src/estado/usarAvisos.ts`, `interface/src/componentes/Aviso.vue`, `interface/src/componentes/DialogoConfirmacao.vue`, `interface/src/componentes/PainelLateral.vue`, `interface/src/componentes/BarraProgresso.vue`, `testes/interface/fila.spec.ts`, `testes/interface/configuracoes.spec.ts`, `testes/interface/projetos.spec.ts`

**Interfaces:**
- Produces (assinaturas preservadas): `avisar(texto: string, tipo?: "sucesso" | "erro"): void` (agora chama `toast.success`/`toast.error` do `vue-sonner`, duração 5000 e 9000 ms); `confirmar(opcoes: { titulo: string; texto: string; botao: string }): Promise<boolean>` e `usarConfirmacao()` inalterados; `PainelLateral` com as mesmas props e eventos (`aberto: boolean`, `titulo: string`, evento `fechar`) e `role="dialog"` com `aria-label` igual ao título; `BarraProgresso` com as mesmas props (`valor: number`, `rotulo?: string`) e `role="progressbar"`.

- [ ] **Step 1: Escrever os testes de teclado (devem falhar) e ler os testes que dependem dos toasts**

Em `projetos.spec.ts`, acrescentar `Esc fecha o painel lateral`: abrir "Novo projeto", pressionar `Escape`, o `dialog` "Novo projeto" some. Em `configuracoes.spec.ts`, acrescentar `Esc no diálogo de confirmação não apaga nada`: abrir o diálogo de "Apagar dados antigos já convertidos", pressionar `Escape`, o `alertdialog` some e a ação **não** foi chamada (a lista de dados antigos continua como estava). Nos testes que hoje usam `getByRole("status")` / `getByRole("alert")` para avisos, localizar o aviso pelo **texto** dentro de `getByRole("region", { name: /notifications/i })` (como o `vue-sonner` o expõe), mantendo o texto esperado; e `getByRole("dialog")` do diálogo de confirmação passa a ser `getByRole("alertdialog")`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run teste:interface -- testes/interface/projetos.spec.ts testes/interface/configuracoes.spec.ts testes/interface/fila.spec.ts`
Expected: FAIL nos testes novos e nos seletores ajustados.

- [ ] **Step 3: Implementar**

`Aviso.vue` passa a renderizar só o `<Toaster />` do `@/components/ui/sonner` (com `rich-colors` e posição inferior direita) e `usarAvisos.ts` chama `toast`; o estado interno de lista é removido. `DialogoConfirmacao.vue` usa `AlertDialog` controlado por `pedido`, com `AlertDialogCancel` "Voltar" e `AlertDialogAction` com `pedido.botao`; qualquer fechamento sem clicar na ação (inclusive `Esc`) chama `pedido.responder(false)`. `PainelLateral.vue` usa `Sheet` (`side="right"`) com `SheetTitle`, mantendo `role="dialog"` e o `aria-label` do título. `BarraProgresso.vue` usa `Progress` e repassa `aria-label`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run teste:interface -- testes/interface/projetos.spec.ts testes/interface/configuracoes.spec.ts testes/interface/fila.spec.ts`
Expected: PASS.

- [ ] **Step 5: Suíte completa e commit**

Run: `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface testes
git commit -m "Avisos, confirmação, painel lateral e progresso com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Seletor de modelo e tela Projetos

**Files:**
- Modify: `interface/src/componentes/SeletorModelo.vue`, `interface/src/telas/TelaProjetos.vue`, `testes/interface/projetos.spec.ts`

**Interfaces:**
- Produces: `SeletorModelo` com as mesmas props (`modelValue: string`, `permitirPadrao: boolean`, `rotuloPadrao?: string`, `rotulo?: string`) e evento `update:modelValue`, agora sobre `Select` (o valor vazio `""` do "padrão do sistema" vira o item com valor sentinela `"__padrao__"` convertido de volta para `""` no evento); o `combobox` tem `aria-label` igual a `rotulo ?? "Modelo do Ollama"`.

- [ ] **Step 1: Ajustar o teste para o `Select`**

Em `projetos.spec.ts`, onde houver escolha do modelo, usar `escolherOpcao`. Os testes `cartão avisa quando o modelo do projeto não está instalado` e `criar, editar, validar e excluir projeto` mantêm suas asserções (`article`, `inicial`, "Modelo não instalado: llama9", "Salvar alterações", duração).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run teste:interface -- testes/interface/projetos.spec.ts`
Expected: FAIL onde o teste usa o seletor novo.

- [ ] **Step 3: Implementar**

`SeletorModelo` sobre `Select`. `TelaProjetos`: cabeçalho com `h1` "Projetos" e `Button` "Novo projeto" (ícone `Plus`); estado vazio com o texto atual; grade de `Card` com `role="article"` por projeto (ícone `FolderKanban`, o `data-testid="inicial"` preservado no avatar), `Badge` `variant="destructive"` para "Modelo não instalado: …", botões "Editar" (`Pencil`) e "Excluir" (`Trash2`, `variant="destructive"`); formulário do painel com `Label`, `Input`, `Button` e erro em `Alert` com `role="alert"`. Remover o `<style scoped>` da tela.

- [ ] **Step 4: Rodar e ver passar; suíte completa; commit**

Run: `npm run teste:interface -- testes/interface/projetos.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface testes
git commit -m "Tela Projetos e seletor de modelo com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tela Produção (quadro)

**Files:**
- Modify: `interface/src/telas/TelaProducao.vue`, `interface/src/componentes/ColunaQuadro.vue`, `interface/src/componentes/CartaoCapitulo.vue`

**Interfaces:**
- Consumes: `BarraProgresso` (Tarefa 4).
- Produces: `ColunaQuadro` (props `titulo: string`, `quantidade: number`) mantém um `<section aria-label={titulo}>` (role `region`); `CartaoCapitulo` (props `capitulo: Capitulo`, `tarefaAtiva: Tarefa | null`; eventos `abrir`, `gerar`) mantém `role="article"`.

- [ ] **Step 1: Rodar o teste de produção como linha de base**

Run: `npm run teste:interface -- testes/interface/producao.spec.ts`
Expected: PASS (antes de mexer; esta tarefa não muda seletores).

- [ ] **Step 2: Implementar**

`TelaProducao`: `h1` + botão "Ver dossiê" (`BookOpen`), estado "sem projeto" e "sem capítulos" em `Empty` (ícone `Clapperboard`, botão "Planejar história", mesmos textos), quadro em colunas (`grid` responsivo). `ColunaQuadro`: `section` com `aria-label`, cabeçalho com título e `Badge` com a quantidade, "Nenhum capítulo aqui." em texto suave. `CartaoCapitulo`: `Card` com `role="article"`, título como botão de link ("Cap. N · Título"), `Progress` quando há tarefa, `Badge` de situação (`secondary`, `outline` ou colorido para "Aguardando aprovação" e "Roteiro aprovado") e botão "Gerar roteiro" (ícone `Sparkles`). Textos idênticos aos de hoje. Remover os `<style scoped>`.

- [ ] **Step 3: Rodar, suíte completa, commit**

Run: `npm run teste:interface -- testes/interface/producao.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface
git commit -m "Tela Produção com colunas de Card

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Tela Planejamento e EditorLista

**Files:**
- Modify: `interface/src/telas/TelaPlanejamento.vue`, `interface/src/componentes/EditorLista.vue`

**Interfaces:**
- Produces: `EditorLista<T>` (props `modelValue: T[]`, `rotuloItem: string`, `novo: () => T`; slot `item`; evento `update:modelValue`) mantém um `<fieldset>` com `<legend>` "{rotuloItem} {n}" por item (role `group`, nome "Personagem 1", "Capítulo 2"…), botões "Subir", "Descer", "Remover" (com o `aria-label` "Remover {rotuloItem em minúsculas} {n}") e "Adicionar {rotuloItem em minúsculas}".

- [ ] **Step 1: Linha de base**

Run: `npm run teste:interface -- testes/interface/producao.spec.ts testes/interface/revisaoDossie.spec.ts`
Expected: PASS.

- [ ] **Step 2: Implementar**

`EditorLista`: cada item é um `fieldset` estilizado como `Card` (classes do Tailwind sobre o `fieldset`, não o componente `Card`, para não perder o papel `group`), botões `Button` `variant="outline"` com ícones `ArrowUp`, `ArrowDown` e `Trash2` (`variant="destructive"`), e `Plus` no "Adicionar". `TelaPlanejamento`: `Card` com `Textarea` "Enredo", campos da proposta (`Label`/`Input`/`Textarea` com os rótulos atuais, entre eles "Sinopse"), estados de carregamento com `Skeleton` e `Progress` conforme a tela já faz, botão "Confirmar" mantido. Textos e rótulos idênticos. Remover os `<style scoped>`.

- [ ] **Step 3: Rodar, suíte completa, commit**

Run: `npm run teste:interface -- testes/interface/producao.spec.ts testes/interface/revisaoDossie.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface
git commit -m "Tela Planejamento e EditorLista com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tela Revisão

**Files:**
- Modify: `interface/src/telas/TelaRevisao.vue`

- [ ] **Step 1: Linha de base**

Run: `npm run teste:interface -- testes/interface/revisaoDossie.spec.ts`
Expected: PASS.

- [ ] **Step 2: Implementar**

`h1` "Revisão"; estado sem projeto e "Nada esperando por você. Gere roteiros na tela Produção." em `Empty` (ícone `ClipboardCheck`); cada pendência é um `Card` de uma linha com o link "Cap. N · Título" (mantendo `role="listitem"` num contêiner `role="list"`), `Badge` com a descrição do tipo e "desde …" em texto suave. Textos idênticos. Remover o `<style scoped>`.

- [ ] **Step 3: Rodar, suíte completa, commit**

Run: `npm run teste:interface -- testes/interface/revisaoDossie.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface
git commit -m "Tela Revisão com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tela Dossiê

**Files:**
- Modify: `interface/src/telas/TelaDossie.vue`

- [ ] **Step 1: Linha de base**

Run: `npm run teste:interface -- testes/interface/revisaoDossie.spec.ts`
Expected: PASS.

- [ ] **Step 2: Implementar**

Cada seção do dossiê vira um `Card` com `<h2>` (nível 2, nome igual ao de hoje) no `CardHeader`, empilhados e separados por `Separator`; campos com `Label`/`Input`/`Textarea` e rótulos atuais ("Aparência fixa", "Dossiê em JSON"…); rodapé fixo com "Salvar" e "Ver JSON" (`Save`, `Braces`) e o erro com o caminho do campo em `Alert` `variant="destructive"`. Os grupos "Personagem N" continuam via `EditorLista`. Textos idênticos. Remover o `<style scoped>`.

- [ ] **Step 3: Rodar, suíte completa, commit**

Run: `npm run teste:interface -- testes/interface/revisaoDossie.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface
git commit -m "Tela Dossiê com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Tela Capítulo

**Files:**
- Modify: `interface/src/telas/TelaCapitulo.vue`, `testes/interface/capitulo.spec.ts`

**Interfaces:**
- Consumes: `escolherOpcao(page, rotulo, opcao)` e `valorDoSeletor(page, rotulo)` de `testes/interface/apoio.ts` (Tarefa 3).

- [ ] **Step 1: Ajustar o teste para o `Select`**

Em `capitulo.spec.ts`: `page.getByLabel("Gerar com").selectOption("qwen3.6:latest")` vira `escolherOpcao(page, "Gerar com", "qwen3.6:latest")`; `expect(page.getByLabel("Versão")).toHaveValue("2", …)` vira `expect(valorDoSeletor(page, "Versão")).toHaveText(/2/, { timeout: 10000 })`. As demais asserções (região "Roteiro", lista "Cenas", alertas de corte de contexto e de CPU, aprovação) ficam como estão.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run teste:interface -- testes/interface/capitulo.spec.ts`
Expected: FAIL (a tela ainda usa `<select>` nativo).

- [ ] **Step 3: Implementar**

Layout em duas colunas (principal e lateral que fica fixa no topo da área de rolagem, `sticky top-0`, empilhando em janelas estreitas). Principal: `Card` "Roteiro" (`<section aria-label="Roteiro">`), lista "Cenas" (`role="list"`, nome "Cenas") com `Card` por cena, "Versão" como `Select`, avisos de corte de contexto e de modelo na CPU em `Alert`, problemas de continuidade em `Alert`. Lateral: "Gerar com" como `Select`, `Textarea` "O que corrigir", botões "Refazer" (`RefreshCw`) e "Aprovar" (`Check`), `Progress` durante a tarefa. Rótulos, textos e `aria-label` idênticos aos de hoje. Remover o `<style scoped>`.

- [ ] **Step 4: Rodar e ver passar; suíte completa; commit**

Run: `npm run teste:interface -- testes/interface/capitulo.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface testes
git commit -m "Tela Capítulo com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Tela Configurações

**Files:**
- Modify: `interface/src/telas/TelaConfiguracoes.vue`, `testes/interface/configuracoes.spec.ts`

- [ ] **Step 1: Ajustar o teste para o `Select`**

Em `configuracoes.spec.ts`: `getByLabel("Modelo principal", { exact: true }).selectOption("qwen3.6:latest")` vira `escolherOpcao(page, "Modelo principal", "qwen3.6:latest")` (cuidar de `exact: true`: o nome deve casar exatamente), e `toHaveValue("qwen3.6:latest")` vira `toHaveText(/qwen3\.6:latest/)` sobre `valorDoSeletor`. Os testes de contexto, credenciais e apagar dados mantêm suas asserções.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run teste:interface -- testes/interface/configuracoes.spec.ts`
Expected: FAIL (a tela ainda usa `<select>` nativo).

- [ ] **Step 3: Implementar**

Seções (`Modelos`, `Contexto`, `Credenciais do YouTube`, `Canais conectados`, `Dados antigos`…, as que a tela tem hoje) como `Card` empilhados com `Separator`, cada título num `<h2>` com o mesmo nome. Canais conectados e tabelas de modelos em `Table`. Campos em `Label`/`Input`; "Client Secret" mantém `type="password"` e o valor limpo após salvar; erros do servidor em `Alert`; "Apagar dados antigos já convertidos" abre o `AlertDialog` via `confirmar`. Os ícones: `Cpu` (modelos), `Youtube` (credenciais), `Trash2` (apagar). Textos e rótulos idênticos. Remover o `<style scoped>`.

- [ ] **Step 4: Rodar e ver passar; suíte completa; commit**

Run: `npm run teste:interface -- testes/interface/configuracoes.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface testes
git commit -m "Tela Configurações com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tela Boas-vindas e NavegadorPastas

**Files:**
- Modify: `interface/src/telas/TelaBoasVindas.vue`, `interface/src/componentes/NavegadorPastas.vue`

**Interfaces:**
- Produces: `NavegadorPastas` mantém `aria-label` "Caminho da pasta" no campo de caminho, "Nome da nova pasta", o botão "Usar esta pasta", e os `data-testid` `caminho-atual`; mantém o aviso "Evite pastas de rede (compartilhamentos do Windows, NAS)…".

- [ ] **Step 1: Linha de base**

Run: `npm run teste:interface -- testes/interface/boasVindas.spec.ts`
Expected: PASS.

- [ ] **Step 2: Implementar**

Tela cheia, centralizada: `Card` com marca e o texto atual, `NavegadorPastas` com `Input` (caminho), `ScrollArea` com a lista de pastas (botões com `Folder`; a pasta atual com `FolderOpen`), campo "Nome da nova pasta" com `Button` (`FolderPlus`), erro do servidor em `Alert` `variant="destructive"` ("Pasta não encontrada" etc.), e o botão principal "Usar esta pasta". Textos idênticos. Remover os `<style scoped>`.

- [ ] **Step 3: Rodar, suíte completa, commit**

Run: `npm run teste:interface -- testes/interface/boasVindas.spec.ts`, depois `npm run verificar` e `npm run teste:interface`
Expected: verde.

```bash
git add -A interface
git commit -m "Tela Boas-vindas e navegador de pastas com shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Limpeza e verificação final

**Files:**
- Delete: `interface/src/estilos/temas.css`, `interface/src/estilos/base.css`, `interface/src/estado/compatTema.ts`, `.opencode/` (pasta não versionada)
- Modify: `interface/src/main.ts`, `docs/superpowers/specs/2026-10-06-interface-shadcn-design.md` (Status), `docs/superpowers/plans/2026-10-06-interface-shadcn.md` (marcar as tarefas)

- [ ] **Step 1: Provar que nada usa o CSS antigo**

Run: `grep -rn "data-tema\|var(--fundo\|var(--cartao\|var(--texto\|class=\"botao\|class=\"tela\|class=\"campo" interface/src testes`
Expected: nenhuma ocorrência fora de `temas.css`, `base.css` e `compatTema.ts` (se houver, a tela correspondente não foi migrada: migrar antes de seguir).

- [ ] **Step 2: Remover o CSS antigo e a ponte**

Apagar os quatro itens de *Delete*; em `main.ts`, remover os imports de `temas.css`, `base.css` e `compatTema`. Conferir que `interface/src/estilos/` só tem `global.css`.

- [ ] **Step 3: Verificação completa**

Run: `npm run verificar`, `npm test` e `npm run teste:interface`
Expected: tipos limpos; testes do servidor passam; testes da interface passam.

- [ ] **Step 4: Build de produção**

Run: `npm run construir:interface`
Expected: gera `interface/dist/` sem erros nem avisos de CSS.

- [ ] **Step 5: Conferir no navegador**

Iniciar `npm run iniciar`, abrir cada uma das 8 telas nos temas claro e escuro, e a barra lateral recolhida e em janela estreita; conferir que nada ficou cortado ou sem estilo. Registrar o que viu na mensagem do commit.

- [ ] **Step 6: Commit**

```bash
git add -A interface docs
git commit -m "Remove o CSS antigo; interface inteira no shadcn-vue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
