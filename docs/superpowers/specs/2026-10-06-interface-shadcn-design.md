# Spec: Interface com shadcn-vue

Data: 2026-10-06 · Status: aguardando revisão

Este documento descreve a troca da base visual da interface (`interface/`) pelo shadcn-vue. Ele substitui o plano de "Dashboard Shell" que o opencode deixou em `.opencode/plan/refatoracao-dashboard.md`; a Fase 1 desse plano (estrutura fixa com scroll só no conteúdo) está incorporada aqui.

## 1. Contexto e objetivo

A interface é Vue 3 com Vite, cerca de 2.350 linhas entre CSS e telas, escritas à mão: 8 telas, 14 componentes, dois temas em variáveis CSS (`temas.css`) e 23 testes do Playwright em `testes/interface/`. Cada componente novo (tabela, diálogo, seletor) precisa ser escrito e tornado acessível do zero.

O objetivo é uma interface de painel administrativo moderna, montada sobre o shadcn-vue (Tailwind v4 e Reka UI), com:

- as cores, o espaçamento e os componentes **padrão** do shadcn-vue, com o mínimo de personalização;
- tema claro e escuro;
- ícones Lucide;
- layout fixo no estilo do bloco `dashboard-01`: barra lateral recolhível, cabeçalho e uma única área de conteúdo com rolagem;
- todas as telas migradas, para que não sobre mistura de dois estilos.

### Critérios de sucesso

1. Todas as 8 telas usam componentes do shadcn-vue; não resta CSS de layout ou de tema escrito à mão fora de `interface/src/estilos/` (que passa a conter apenas a entrada do Tailwind e as variáveis do shadcn).
2. Barra lateral e cabeçalho ficam parados; só a área de conteúdo rola.
3. O tema claro, o escuro e o do sistema funcionam, e a escolha continua salva entre sessões.
4. Adicionar um componente novo é `npx shadcn-vue add <nome>`, sem escrever CSS.
5. `npm run verificar` e `npm run teste:interface` passam ao fim de cada etapa e no final.

## 2. Fora do escopo

- Servidor, API, banco e regras de negócio não mudam.
- Nenhuma funcionalidade nova entra nesta branch: o visual muda, o comportamento de cada tela é o mesmo.
- Gráficos, paleta de comandos e tabelas com ordenação ou paginação não entram (o `dashboard-01` os tem; aqui só serve de referência de layout).
- Internacionalização: os textos continuam em português, escritos direto nos componentes.

## 3. Fundação

- **Dependências novas:** `tailwindcss`, `@tailwindcss/vite`, `lucide-vue-next`, `@vueuse/core`, e as que o CLI do shadcn-vue acrescentar (`reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `vue-sonner`).
- **Vite:** o plugin `tailwindcss()` entra em `interface/vite.config.ts`, junto do alias `@` apontando para `interface/src`.
- **TypeScript:** `interface/tsconfig.json` ganha `baseUrl` e `paths` com `@/*`. O `vue-tsc` do `npm run verificar` lê esse arquivo.
- **CLI:** `shadcn-vue init` com o estilo padrão e a base de cor `neutral`. O `components.json` fica em `interface/`. Os componentes são gerados em `interface/src/components/ui/`.
- **Regra:** os arquivos de `components/ui/` são gerados e **não são editados à mão**. Qualquer ajuste visual vai em quem os usa, por classes do Tailwind.
- **CSS:** `interface/src/estilos/` passa a ter só `global.css` (`@import "tailwindcss"` e as variáveis do tema que o CLI gera). `temas.css` e `base.css` são removidos ao fim, depois que nenhuma tela os usa.

## 4. Tema

- `useColorMode` do `@vueuse/core`, com a classe `dark` no `<html>`.
- Três opções: **Claro**, **Escuro** e **Sistema**. O padrão na primeira abertura é **Escuro**, como hoje.
- A escolha fica salva na chave `gangoy.tema` do `localStorage`. Os valores antigos (`escuro` e `claro`) são lidos e convertidos para os do VueUse, para ninguém perder a preferência.
- A troca fica num `DropdownMenu` no rodapé da barra lateral, com os ícones `Sun`, `Moon` e `Monitor`.
- `estado/usarTema.ts` e `componentes/TrocaTema.vue` são substituídos por um componente de troca (`ModoTema.vue`) sobre `useColorMode`.

## 5. Shell

Estrutura de `App.vue` (a tela de boas-vindas continua fora dela, em tela cheia):

```
SidebarProvider
├── Sidebar (collapsible="icon")
│   ├── SidebarHeader     marca do Gangoy Vídeos
│   ├── SidebarContent    menu principal
│   └── SidebarFooter     troca de tema
└── SidebarInset
    ├── header            gatilho da barra, seletor de projeto, fila, status
    ├── Alert             faixa de workspace ausente (quando aplicável)
    └── main              única área com rolagem
```

| Item do menu | Ícone Lucide |
|---|---|
| Produção | `Clapperboard` |
| Revisão | `ClipboardCheck` |
| Dossiê | `BookOpen` |
| Projetos | `FolderKanban` |
| Configurações | `Settings` |

- O menu mantém `aria-label="Menu principal"` e os mesmos nomes de link, para os testes continuarem válidos.
- O cabeçalho contém: `SidebarTrigger`; o seletor de projeto (`Select`); o indicador da fila como `Popover`, mantendo o nome acessível "Fila: N executando · M aguardando"; e os pontos de status do Ollama e da workspace, cada um num `Tooltip` e mantendo os `title` atuais ("Ollama online", "Workspace disponível").
- `SidebarInset` ocupa a altura da janela e só o `main` rola, o que substitui o CSS de `.estrutura`/`.area` do opencode.
- A barra lateral fica recolhida em ícones em janelas estreitas.

## 6. Mapa de componentes

| Hoje | Passa a ser |
|---|---|
| `.cartao`, `.tela` e painéis soltos | `Card` com `CardHeader`, `CardContent` e `CardFooter` |
| `.botao`, `.botao.principal` e `.botao.perigo` | `Button` com `variant` (`default`, `outline` e `destructive`) |
| `input`, `textarea` e `label.campo` | `Input`, `Textarea` e `Label` |
| `<select>` nativos (modelo, projeto, versão) | `Select` |
| listas de projetos e capítulos | `Table` |
| estados (modelo não instalado, corte de contexto, CPU) | `Badge` e `Alert` |
| `BarraProgresso` | `Progress` |
| `DialogoConfirmacao` | `AlertDialog` |
| `PainelLateral` | `Sheet` |
| `Aviso` | `Sonner` |
| seções do dossiê e das configurações | `Tabs` e `Separator` |
| mensagens "Nenhum projeto ainda." e semelhantes | `Empty` |
| `NavegadorPastas` | `ScrollArea`, `Button` e ícones `Folder` e `FolderOpen` |

Componentes que não têm equivalente direto (`CartaoCapitulo`, `ColunaQuadro`, `EditorLista`, `IndicadorFila`) continuam existindo, reescritos sobre `Card`, `Badge` e `Button`.

## 7. Telas

Migradas uma por vez, nesta ordem, cada uma num commit:

1. Projetos
2. Produção (quadro em colunas de `Card`)
3. Planejamento
4. Revisão
5. Dossiê
6. Capítulo
7. Configurações
8. Boas-vindas

Em cada tela, o comportamento e os textos continuam os mesmos; o que muda é a marcação e o estilo. Os ícones entram onde ajudam a leitura (ações, estados, estados vazios), sem enfeitar por enfeitar.

## 8. Testes

- Os testes do Playwright já usam papéis, rótulos e textos acessíveis. Esses seletores são preservados: os componentes novos mantêm os mesmos nomes acessíveis.
- **O que precisa mudar:**
  - Os `Select` do shadcn-vue não são `<select>` nativos; testes que usam `selectOption` passam a abrir o seletor e clicar na opção.
  - `tema.spec.ts` deixa de olhar `data-tema` e passa a olhar a classe `dark` do `<html>`.
  - Toasts do `Sonner` e o diálogo do `AlertDialog` têm papéis próprios (`status` e `alertdialog`); os testes que esperavam `dialog` ou `status` são ajustados onde for o caso.
- Nenhum teste é removido nem enfraquecido para passar; se um seletor deixa de existir, o teste é reescrito para verificar o mesmo comportamento.
- Ao fim de cada etapa: `npm run verificar` e `npm run teste:interface` verdes, depois o commit.
- O `npm run iniciar` (build de produção do Vite) também precisa gerar `interface/dist` sem erros, verificado ao fim.

## 9. Riscos

- **Volume:** são 8 telas e 14 componentes reescritos. Mitigação: uma tela por commit, com os testes passando entre elas.
- **Os dois estilos convivem durante a migração.** Mitigação: o CSS antigo só é removido na última etapa; o Tailwind e o CSS antigo usam nomes de classe diferentes, então não colidem.
- **Seletores dos testes.** Mitigação: seção 8; o comportamento testado não muda.
- **Versões:** Tailwind v4 e shadcn-vue evoluem rápido. Mitigação: o CLI gera o código para a versão instalada, e as versões ficam travadas no `package-lock.json`.

## 10. Branch e entrega

O trabalho acontece na branch `layout-dashboard` (já criada, com as mudanças da Fase 1 do opencode como ponto de partida, que a Seção 5 supera). Entrega por PR contra a `main`, que é protegida; só o usuário aceita o PR. A pasta `.opencode/` (o plano antigo, que nunca foi versionado) é apagada ao fim, já que esta especificação a substitui.
