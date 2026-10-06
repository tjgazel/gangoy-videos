# Gangoy Vídeos — Subprojeto 1: base do sistema — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Gangoy Vídeos com workspace própria, painel Vue com quadro de produção, fila de tarefas com progresso ao vivo, seleção de modelos do Ollama com proteção de contexto, credenciais no banco, compatibilidade Windows/Linux e testes automatizados.

**Architecture:** O servidor Fastify passa a ser criado por `criarApp(opcoes)` e lê tudo a partir da workspace (`Gangoy-workspace/`, com `gangoy.db` dentro). Trabalhos longos viram registros na tabela `tarefas`, executados um por vez por uma fila que emite eventos (SSE). A interface sai de `public/` e vira um app Vue 3 em `interface/`, servido pronto pelo Fastify.

**Tech Stack:** Node 22, TypeScript, Fastify 5, `node:sqlite`, Zod 4, Vue 3.5, Vue Router 5, Vite 8, `node:test` + `tsx`, Playwright 1.63 com Google Chrome instalado.

**Spec:** [docs/superpowers/specs/2026-10-06-gangoy-videos-design.md](../specs/2026-10-06-gangoy-videos-design.md) · contexto em [2026-10-06-gangoy-videos-visao-geral-design.md](../specs/2026-10-06-gangoy-videos-visao-geral-design.md)

## Global Constraints

- Node `>=22.12` (exigência do Vite 8); ESM; TypeScript `strict`.
- Código (variáveis, funções, arquivos, pastas) em português sem acento nem caractere especial. Textos da interface e mensagens de erro em pt-BR com acento.
- Dependências novas permitidas, e só estas: `vue@^3.5.43`, `vue-router@^5.3.1`; dev: `vite@^8.3.3`, `@vitejs/plugin-vue@^6.0.9`, `vue-tsc@^3.3.12`, `concurrently@^10.0.5`, `@playwright/test@^1.63.0`. Sem Pinia, Tailwind ou biblioteca de componentes.
- Playwright usa `channel: "chrome"` (Chrome instalado). **Nunca** rodar `npx playwright install`.
- Servidor ouve só em `127.0.0.1`. Portas: 3000 (app), 5173 (Vite em dev), 3100 (testes de interface).
- Caminhos sempre com `node:path` (`join`, `resolve`, `relative`, `dirname`); nenhum `\` ou `/` fixo em caminho de arquivo.
- Nenhuma rota devolve `client_secret`, tokens ou o conteúdo da chave.
- Workspace: pasta `Gangoy-workspace`, marcador `.gangoy-workspace.json` (`{ "versao": 1, "criadoEm": "<ISO>" }`), banco `gangoy.db`, lixeira `.lixeira/`, capítulo `capitulos/capitulo-NNN/` com subpastas `roteiro/`, `imagens/`, `audio/cenas/`, `legenda/`, `video/`.
- Configuração da máquina em `dados/configuracao-local.json` (`{ "pastaWorkspace": "<absoluto>" }`).
- Padrões: `contexto_trabalho` 32768; `fator_tokens` 3,0; reservas de resposta: roteiro 6000, refazer 6000, planejamento 4000, continuidade 2000, proposta de dossiê 2000.
- Ao fim de cada tarefa: `npm run verificar` e `npm test` passam.
- Commits em português, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não fazer `push`.
- Referência visual (pasta local, fora do Git): `.superpowers/brainstorm/2427-1791280571/content/layout.html` (opção C), `estilo-visual-v2.html` e `revisao.html`.

## Review Focus

1. **Caminho com espaço e acento** (ex.: `D:\Meus Vídeos ação`): criar workspace, converter e mover funcionam normalmente. Teste na Tarefa 5.
2. **Disco removido durante uma tarefa** (marcador some no meio da geração): a tarefa termina como `falhou` com "Workspace não encontrada em …", sem derrubar o servidor. Teste na Tarefa 13.
3. **Nome de modelo sem tag** (`qwen3.6` configurado, Ollama lista `qwen3.6:latest`): é tratado como o mesmo modelo, não como "não instalado". Teste na Tarefa 12.
4. **Pasta sem permissão no navegador de pastas** (ex.: perfil de outro usuário): responde 403 "Sem permissão para abrir esta pasta" e pastas ilegíveis dentro de uma listagem são puladas. Teste na Tarefa 7.
5. **Recarregar a página com tarefa em execução**: o cartão continua mostrando o progresso (estado vem de `GET /api/tarefas`, não só do SSE). Teste na Tarefa 16.

---

### Task 1: Base de testes e `criarApp()`

**Files:**
- Create: `src/nucleo/opcoesExecucao.ts`, `src/servidor/app.ts`, `testes/apoio/ambiente.ts`, `testes/servidor/app.test.ts`, `.gitattributes`
- Modify: `src/servidor/servidor.ts` (passa a só chamar `criarApp` e `listen`), `src/banco/banco.ts`, `package.json`, `tsconfig.json`, `src/servidor/rotasHistoria.ts`, `src/servidor/rotasYoutube.ts` (remover os `responder()` locais), `src/youtube/oauth.ts` (`uriRetornoOAuth()` usa `obterOpcoesExecucao().porta`)

**Interfaces:**
- Produces:
  - `interface OpcoesExecucao { pastaDados: string; urlOllama: string; porta: number }`; `definirOpcoesExecucao(parcial: Partial<OpcoesExecucao>): void`; `obterOpcoesExecucao(): OpcoesExecucao` (padrões: `resolve("dados")`, `app.json ollama.url`, `app.json porta`).
  - `banco.ts`: `abrirBanco(caminhoArquivo: string): DatabaseSync` (cria tabelas, WAL, `foreign_keys`), `fecharBanco(): void`, `obterBanco(): DatabaseSync` (sem banco aberto → `ErroAplicacao("Nenhuma workspace aberta", 503)`).
  - `criarApp(opcoes?: Partial<OpcoesExecucao>): Promise<FastifyInstance>` em `src/servidor/app.ts`.
  - `testes/apoio/ambiente.ts`: `criarPastaTemporaria(prefixo: string): string`, `removerPasta(caminho: string): void`.

- [ ] **Step 1: Scripts, `tsconfig` e `.gitattributes`**

`package.json` scripts: `"test": "node --import tsx --test \"testes/servidor/**/*.test.ts\""`, `"verificar": "tsc --noEmit"` (a Tarefa 15 acrescenta o `vue-tsc`). `tsconfig.json` `include`: `["src/**/*.ts", "testes/**/*.ts", "scripts/**/*.ts"]`. `.gitattributes`: `* text=auto eol=lf`.

- [ ] **Step 2: Escrever os testes que falham** (`testes/servidor/app.test.ts`)

```ts
test("Host diferente de localhost/127.0.0.1 recebe 403", async () => {
  const app = await criarApp({ porta: 3999, pastaDados: tmp });
  const r = await app.inject({ url: "/api/configuracoes/app", headers: { host: "malicioso.com:3999" } });
  assert.equal(r.statusCode, 403);
});
test("Host localhost:<porta>, 127.0.0.1:<porta> e localhost:5173 são aceitos", ...); // 3 injects → 200
test("ErroAplicacao vira { erro } com o status", async () => {
  const app = await criarApp({ porta: 3999, pastaDados: tmp });
  app.get("/api/__erro", async () => { throw new ErroAplicacao("Proibido aqui", 418); });
  const r = await app.inject({ url: "/api/__erro", headers: { host: "localhost:3999" } });
  assert.equal(r.statusCode, 418);
  assert.deepEqual(r.json(), { erro: "Proibido aqui" });
});
test("ZodError vira 400 com a primeira mensagem", ...); // rota de teste que faz z.string().min(3,"Curto").parse("a") → { erro: "Curto" }
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --import tsx --test testes/servidor/app.test.ts` · Expected: FAIL (`criarApp` não existe).

- [ ] **Step 4: Implementar**

`criarApp`: `definirOpcoesExecucao(opcoes)`; parser JSON que aceita corpo vazio (o atual); hook `onRequest` que recusa com 403 `{ erro: "Acesso recusado" }` quando `Host` não é `localhost:<porta>`, `127.0.0.1:<porta>`, `localhost:5173` ou `127.0.0.1:5173`; `setErrorHandler` central (`ErroAplicacao` → status + `{ erro }`; `ZodError` → 400 + primeira mensagem; demais → 500 `{ erro: "Erro inesperado. Veja o log do servidor." }` e log); registra as rotas atuais. Até a Tarefa 5, `criarApp` abre `abrirBanco(join(pastaDados, "app.db"))`. `servidor.ts`: `const app = await criarApp(); await app.listen({ port: obterOpcoesExecucao().porta, host: "127.0.0.1" })`.

- [ ] **Step 5: Rodar e ver passar** — `npm test` e `npm run verificar`: PASS.

- [ ] **Step 6: Commit** — `git commit -m "Base de testes, criarApp e tratador de erro central"`

---

### Task 2: Mensagens de validação em pt-BR

**Files:**
- Create: `src/nucleo/mensagensValidacao.ts`, `testes/servidor/mensagensValidacao.test.ts`
- Modify: `src/servidor/app.ts` (importa o módulo antes de tudo e usa `formatarProblema` no tratador), `src/ollama/ollama.ts` (usa `formatarProblema` na mensagem de reenvio), `src/projetos/projetos.ts` (mensagens por regra da duração)

**Interfaces:**
- Produces: `configurarMensagensValidacao(): void` (chama `z.config({ customError })`, executado ao importar); `formatarCaminho(caminho: PropertyKey[]): string`; `formatarProblema(problema: z.core.$ZodIssue): string`.

- [ ] **Step 1: Testes que falham**

```ts
test("too_big de número", () => { msg(z.number().max(10), 12) === "Deve ser no máximo 10"; });
test("too_small de texto", () => msg(z.string().min(3), "a") === "Deve ter pelo menos 3 caracteres");
test("too_small de lista", () => msg(z.array(z.string()).min(1), []) === "Deve ter pelo menos 1 item");
test("campo ausente", () => msg(z.object({ nome: z.string() }), {}) === "nome: campo obrigatório");
test("tipo errado", () => msg(z.number(), "x") === "Tipo inválido: esperado número");
test("enum", () => msg(z.enum(["a","b"]), "c") === "Valor inválido: use um destes: a, b");
test("chave desconhecida", () => msg(z.strictObject({}), { x: 1 }) === "Campo não reconhecido: x");
test("caminho legível", () => formatarCaminho(["personagens", 1, "aparenciaFixa"]) === "Personagens › item 2 › Aparência fixa");
test("problema com caminho", () => /* esquemaDossie com personagens[1].nome ausente */ "Personagens › item 2 › nome: campo obrigatório");
test("mensagem da regra tem prioridade", () => msg(z.number().min(5, "A duração mínima é 5 minutos"), 1) === "A duração mínima é 5 minutos");
test("nenhuma mensagem em inglês nem pt-PT", () => { /* para cada caso acima: */ assert.doesNotMatch(m, /Too |Invalid|expected|Demasiado|esperava que/); });
```
(`msg(esquema, valor)` = `formatarProblema(esquema.safeParse(valor).error!.issues[0])`.)

- [ ] **Step 2: Rodar e ver falhar** — `node --import tsx --test testes/servidor/mensagensValidacao.test.ts` · FAIL.

- [ ] **Step 3: Implementar**

Mensagens por código:

| Código | Mensagem |
|---|---|
| `too_small` número/int (inclusivo / não) | `Deve ser no mínimo {min}` / `Deve ser maior que {min}` |
| `too_small` string | `Deve ter pelo menos {min} caracteres` (1 → `caractere`) |
| `too_small` array/set | `Deve ter pelo menos {min} itens` (1 → `item`) |
| `too_big` (mesma lógica) | `Deve ser no máximo {max}` / `Deve ser menor que {max}` / `Deve ter no máximo {max} caracteres` / `… itens` |
| `invalid_type` com `input === undefined` | `Campo obrigatório` |
| `invalid_type` | `Tipo inválido: esperado {texto}`; `string`→`texto`, `number`/`int`→`número`, `boolean`→`verdadeiro ou falso`, `array`→`lista`, `object`→`objeto`; outro → o nome original |
| `invalid_format` | `email`→`E-mail inválido`; `url`→`Endereço (URL) inválido`; demais → `Formato inválido` |
| `invalid_value` | `Valor inválido: use um destes: {valores separados por ", "}` |
| `unrecognized_keys` | `Campo não reconhecido: {chaves}` |
| `not_multiple_of` | `Deve ser múltiplo de {divisor}` |
| `invalid_union`, `invalid_key`, `invalid_element`, `custom` sem mensagem, desconhecido | `Valor inválido` |

`formatarCaminho`: número `n` → `item {n+1}`; chave com rótulo no mapa (`personagens`→Personagens, `aparenciaFixa`→Aparência fixa, `tracos`→Traços, `fatos`→Fatos, `fiosAbertos`→Fios abertos, `linhaDoTempo`→Linha do tempo, `esbocos` e `esbocosCapitulos`→Esboços, `resumosCapitulos`→Resumos, `sinopse`→Sinopse, `mundo`→Mundo, `cenas`→Cenas, `duracaoPadraoMinutos`→Duração padrão, `frequencia`→Frequência, `clientId`→Client ID, `clientSecret`→Client Secret, `contextoTrabalho`→Contexto de trabalho); demais como estão; separador ` › `. `formatarProblema`: com caminho → `{caminho}: {mensagem com a 1ª letra minúscula}`; sem caminho → a mensagem. Em `projetos.ts`: `min(5, "A duração mínima é 5 minutos")`, `max(10, "A duração máxima é 10 minutos")`.

- [ ] **Step 4: Rodar e ver passar** — `npm test`: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Mensagens de validação próprias em pt-BR"`

---

### Task 3: Tabela `configuracoes` e credenciais do YouTube no banco

**Files:**
- Create: `src/configuracoes/sistema.ts`, `testes/servidor/configuracoes.test.ts`
- Modify: `src/banco/banco.ts` (tabela `configuracoes`), `src/configuracoes/youtube.ts`, `src/servidor/app.ts` (rotas `GET`/`PUT /api/configuracoes/youtube`), `.gitignore` (remover as 3 linhas de `.env`)
- Delete: `src/nucleo/ambiente.ts`, `.env.exemplo`

**Interfaces:**
- Produces:
  - `sistema.ts`: `lerConfiguracao(chave: ChaveConfiguracao): string | null`, `salvarConfiguracao(chave: ChaveConfiguracao, valor: string): void`, `type ChaveConfiguracao = "modelo_principal" | "modelo_leve" | "contexto_trabalho" | "amostras_fator_tokens" | "youtube_client_id" | "youtube_client_secret"`; `obterConfiguracoesSistema(): { modeloPrincipal: string; modeloLeve: string; contextoTrabalho: number }` (padrões: `app.json ollama.modeloPadrao`, `ollama.modeloLeve`, `32768`).
  - `youtube.ts`: `esquemaCredenciaisYoutube` (`clientId` obrigatório "Informe o Client ID do Google Cloud"; `clientSecret` vazio = manter), `salvarCredenciaisYoutube(dados): ResumoCredenciaisYoutube`, `lerResumoCredenciaisYoutube(): { clientId: string; clientSecretSalvo: boolean; conectado: boolean }`, `lerCredenciaisCompletasYoutube(): { clientId: string; clientSecret: string } | null` (mesmo nome usado por `youtube/oauth.ts`).

- [ ] **Step 1: Testes que falham**

```ts
test("padrões do sistema", () => assert.deepEqual(obterConfiguracoesSistema(), { modeloPrincipal: "gemma4:12b-it-qat", modeloLeve: "gemma4:e4b-it-qat", contextoTrabalho: 32768 }));
test("PUT credenciais sem secret na primeira vez → 400 'Informe o Client Secret do Google Cloud'", ...);
test("secret nunca volta na API", async () => { /* PUT com clientSecret "segredo-xyz"; GET → corpo não contém "segredo-xyz" e clientSecretSalvo === true */ });
test("secret vazio mantém o atual", ...); // PUT {clientId:"b", clientSecret:""} → lerCredenciaisCompletasYoutube().clientSecret === "segredo-xyz"
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — tabela `configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL)`; upsert com `ON CONFLICT(chave)`; remover `carregarAmbiente()` de `servidor.ts`/`app.ts`.
- [ ] **Step 4: Rodar e ver passar** — `npm test`, `npm run verificar`: PASS; `git grep -n "loadEnvFile\|ambiente.js"` sem resultado.
- [ ] **Step 5: Commit** — `git commit -m "Credenciais do YouTube de volta ao banco (tabela configuracoes)"`

---

### Task 4: Nomes seguros e conferência de caminho

**Files:**
- Create: `src/nucleo/nomes.ts`, `testes/servidor/nomes.test.ts`
- Modify: `src/projetos/projetos.ts` (passa a importar `gerarSlug` de `nucleo/nomes.ts`)

**Interfaces:**
- Produces: `gerarSlug(texto: string): string`; `validarNomeSimples(nome: string): string` (devolve o nome aparado ou lança `ErroAplicacao` 400); `garantirDentroDe(base: string, alvo: string, caminhos: path.PlatformPath = path): string` (devolve `alvo` resolvido ou lança `ErroAplicacao("Caminho fora da workspace", 400)`).

- [ ] **Step 1: Testes que falham**

```ts
test("slug sem acento", () => assert.equal(gerarSlug("Léo e o Dragão"), "leo-e-o-dragao"));
test("slug reservado do Windows", () => { assert.equal(gerarSlug("CON"), "con-projeto"); assert.equal(gerarSlug("com1"), "com1-projeto"); });
test("nome simples recusa separador, .., reservado e ponto final", () => {
  for (const n of ["a/b", "a\\b", "..", "nul", "con.txt", "pasta.", "pasta ", "a:b", ""]) assert.throws(() => validarNomeSimples(n));
  assert.equal(validarNomeSimples(" Meus Vídeos "), "Meus Vídeos");
});
test("dentro da workspace (posix e win32)", () => {
  assert.throws(() => garantirDentroDe("/ws", "/ws/../etc", path.posix));
  assert.throws(() => garantirDentroDe("C:\\ws", "D:\\outro", path.win32));
  assert.equal(garantirDentroDe("C:\\ws", "C:\\ws\\leo\\dossie.json", path.win32), "C:\\ws\\leo\\dossie.json");
});
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — reservados: `con, prn, aux, nul, com1–com9, lpt1–lpt9`, comparando sem diferenciar maiúsculas e ignorando extensão; proibidos em nome: `/ \ : * ? " < > |` e caracteres de controle; mensagens: "Nome de pasta inválido: {nome}".
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Nomes seguros para Windows e Linux e conferência de caminho"`

---

### Task 5: Workspace (núcleo, caminhos, rotas e status)

**Files:**
- Create: `src/workspace/configuracaoLocal.ts`, `src/workspace/workspace.ts`, `src/workspace/caminhos.ts`, `src/sistema/status.ts`, `src/servidor/rotasWorkspace.ts`, `testes/servidor/workspace.test.ts`
- Modify: `src/servidor/app.ts`, `src/projetos/projetos.ts` (lixeira na workspace, sem `mkdir` em `caminhos.projetos`), `src/capitulos/capitulos.ts` (`capitulo-NNN/roteiro/`), `src/dossie/dossie.ts`, `configuracao/app.json` e `src/nucleo/configuracaoApp.ts` (remover `caminhos.banco` e `caminhos.projetos`)
- Delete: `src/nucleo/caminhos.ts`

**Interfaces:**
- Consumes: `abrirBanco`, `fecharBanco` (Tarefa 1); `validarNomeSimples`, `garantirDentroDe` (Tarefa 4).
- Produces:
  - `configuracaoLocal.ts`: `lerConfiguracaoLocal(): { pastaWorkspace: string | null }`, `salvarConfiguracaoLocal(dados: { pastaWorkspace: string }): void` (arquivo `join(pastaDados, "configuracao-local.json")`).
  - `workspace.ts`: constantes `NOME_PASTA_WORKSPACE = "Gangoy-workspace"`, `ARQUIVO_MARCADOR = ".gangoy-workspace.json"`, `ARQUIVO_BANCO = "gangoy.db"`; `ehWorkspace(caminho: string): boolean`; `localizarWorkspace(local: string): string | null`; `criarOuReconhecerWorkspace(local: string): { caminho: string; criada: boolean }`; `apontarWorkspace(caminho: string): string`; `abrirWorkspaceConfigurada(): void`; `obterPastaWorkspace(): string`; `estadoWorkspace(): EstadoWorkspace`; `definirMovendo(valor: boolean): void`; `type EstadoWorkspace = { configurada: boolean; disponivel: boolean; caminho: string | null; movendo: boolean; espacoLivreBytes: number | null }`; gancho `definirConversaoAoCriar(fn: (pastaWorkspace: string) => void): void` (usado pela Tarefa 6).
  - `caminhos.ts`: `pastaProjeto(slug)`, `caminhoDossie(slug)`, `pastaCapitulo(slug, numero)` (`capitulos/capitulo-001`), `pastaRoteiro(slug, numero)`, `pastaLixeira()` — todos passam por `garantirDentroDe(obterPastaWorkspace(), …)`.
  - `status.ts`: `obterStatusSistema(): Promise<StatusSistema>`, `type StatusSistema = { workspace: EstadoWorkspace; ollama: { online: boolean; versao: string | null; url: string } }` (Ollama via `GET {url}/api/version`, timeout 3 s).
  - Rotas: `GET /api/sistema/status`; `POST /api/workspace` `{ local }` → `{ caminho, criada }`; `POST /api/workspace/apontar` `{ caminho }` → `{ caminho }`.

- [ ] **Step 1: Testes que falham**

```ts
test("cria Gangoy-workspace com marcador e banco", () => { const r = criarOuReconhecerWorkspace(local); assert.equal(r.criada, true); assert.ok(existsSync(join(local, "Gangoy-workspace", ".gangoy-workspace.json"))); assert.ok(existsSync(join(local, "Gangoy-workspace", "gangoy.db"))); });
test("reconhece workspace existente (apontando o local ou a própria pasta)", ...); // segunda chamada → criada === false; mesmo caminho
test("pasta Gangoy-workspace não vazia e sem marcador → 409", ...);
test("local inexistente → 400 'A pasta escolhida não existe'", ...);
test("caminho com espaço e acento", () => { const local = join(tmp, "Meus Vídeos ação"); mkdirSync(local); assert.equal(criarOuReconhecerWorkspace(local).criada, true); /* criar projeto e gravar dossiê funcionam */ });
test("workspace ausente → rotas de dados respondem 503 'Workspace não encontrada em <caminho>'", ...); // apaga o marcador; GET /api/projetos → 503
test("sem workspace configurada → 503 'Nenhuma workspace configurada. Escolha o local na tela de boas-vindas.'", ...);
test("rotas /api/sistema/*, /api/workspace* e /api/configuracoes/app funcionam sem workspace", ...);
test("apontar pasta que não é workspace → 400 'Esta pasta não é uma workspace do Gangoy Vídeos'", ...);
test("excluir projeto move a pasta para <workspace>/.lixeira/<slug>-<data>", ...);
test("roteiro grava em capitulos/capitulo-001/roteiro/roteiro_v1.json", ...);
test("status informa workspace e Ollama offline", ...); // urlOllama apontando para porta fechada → ollama.online === false
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar**

`criarApp` chama `abrirWorkspaceConfigurada()` (não abre mais `dados/app.db`) e registra hook `onRequest` para `/api/*` que chama `obterPastaWorkspace()` exceto em `/api/sistema/`, `/api/workspace`, `/api/configuracoes/app`. `obterPastaWorkspace()` confere o marcador a cada chamada e lança 503 com: não configurada → "Nenhuma workspace configurada. Escolha o local na tela de boas-vindas."; ausente → "Workspace não encontrada em {caminho}"; movendo → "A workspace está sendo movida. Aguarde a conclusão.". Espaço livre via `statfsSync` (`bavail * bsize`). Ordem em `criarOuReconhecerWorkspace` quando cria: pasta + marcador → gancho de conversão (se definido) → `abrirBanco(join(ws, ARQUIVO_BANCO))` → `salvarConfiguracaoLocal`. Subpastas do capítulo criadas só ao gravar (`mkdirSync(…, { recursive: true })` em `salvarNovaVersaoRoteiro`).

- [ ] **Step 4: Rodar e ver passar** — `npm test`, `npm run verificar`: PASS.
- [ ] **Step 5: Commit** — `git commit -m "Workspace Gangoy-workspace com banco, caminhos e status do sistema"`

---

### Task 6: Cópia conferida, conversão dos dados antigos e "Apagar dados antigos"

**Files:**
- Create: `src/workspace/copiaConferida.ts`, `src/workspace/conversao.ts`, `testes/servidor/conversao.test.ts`, `testes/apoio/fixturesAntigas.ts`
- Modify: `src/workspace/workspace.ts` (registra a conversão no gancho), `src/servidor/rotasWorkspace.ts`, `src/sistema/status.ts` (`StatusSistema` ganha `existemDadosAntigos: boolean`, verdadeiro quando há `dados/app.db` ou `dados/projetos/` ainda não convertidos)

**Interfaces:**
- Consumes: `definirConversaoAoCriar`, `obterOpcoesExecucao().pastaDados`.
- Produces:
  - `copiaConferida.ts`: `medirPasta(caminho: string): { arquivos: number; bytes: number }`; `copiarConferindo(origem: string, destino: string, aoProgresso?: (copiados: number, total: number) => void): { arquivos: number; bytes: number }` (lança `ErroAplicacao("A cópia não confere: {arquivo}", 500)`).
  - `conversao.ts`: `existemDadosAntigos(pastaDados: string): boolean`; `converterDadosAntigos(pastaDados: string, pastaWorkspace: string): { projetos: string[]; arquivos: number }`; `listarDadosAntigosConvertidos(): { itens: { nome: string; caminho: string; bytes: number }[] }`; `apagarDadosAntigosConvertidos(): void`.
  - Rotas: `GET /api/workspace/dados-antigos` → `{ itens }`; `DELETE /api/workspace/dados-antigos` → 204 (404 "Não há dados antigos para apagar").
  - `fixturesAntigas.ts`: `criarDadosAntigos(pastaDados: string): void` — cria `app.db` (projeto `leo-e-o-dragao`, `modelo_ollama = "gemma4:12b-it-qat"`, 2 capítulos) e `projetos/leo-e-o-dragao/{dossie.json, capitulos/001/versoes/roteiro_v1.json, roteiro_v2.json, capitulos/002/versoes/roteiro_v1.json}`.

- [ ] **Step 1: Testes que falham**

```ts
test("converte para a estrutura nova", () => { criarDadosAntigos(dados); const ws = criarOuReconhecerWorkspace(local).caminho;
  assert.ok(existsSync(join(ws, "leo-e-o-dragao", "capitulos", "capitulo-001", "roteiro", "roteiro_v2.json")));
  assert.ok(existsSync(join(ws, "leo-e-o-dragao", "dossie.json")));
  assert.ok(existsSync(join(dados, "app.db.migrado")) && existsSync(join(dados, "projetos.migrado")));
  assert.equal(listarProjetos()[0].modeloOllama, ""); /* igual ao padrão → segue o sistema */ });
test("falha na conferência desfaz a workspace nova e mantém dados/ intacto", ...); // injeta copiarConferindo que lança; Gangoy-workspace não existe; dados/app.db existe; 500 com "A conversão dos dados antigos falhou"
test("dados/lixeira não é tocada", ...);
test("apagar dados antigos remove só app.db.migrado e projetos.migrado", ...); // dados/lixeira e configuracao-local.json continuam
test("copiarConferindo detecta tamanho diferente", ...);
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — conversão: `PRAGMA wal_checkpoint(TRUNCATE)` abrindo `dados/app.db` numa conexão própria e fechando; copiar para `gangoy.db`; mapear `capitulos/NNN/versoes/roteiro_vK.json` → `capitulos/capitulo-NNN/roteiro/roteiro_vK.json` e copiar `dossie.json` e qualquer outro arquivo do projeto no mesmo lugar relativo; conferir; renomear originais para `.migrado`. `UPDATE projetos SET modelo_ollama = '' WHERE modelo_ollama = ?` (padrão do `app.json`) depois do `abrirBanco`. Erro final: "A conversão dos dados antigos falhou: {motivo}. Os dados originais continuam em dados/."
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Conversão dos dados antigos para a workspace"`

---

### Task 7: Navegador de pastas

**Files:**
- Create: `src/workspace/navegadorPastas.ts`, `testes/servidor/navegadorPastas.test.ts`
- Modify: `src/servidor/rotasWorkspace.ts`

**Interfaces:**
- Consumes: `validarNomeSimples`.
- Produces: `listarRaizes(plataforma?: NodeJS.Platform): { nome: string; caminho: string }[]` (Windows: unidades `A:\`–`Z:\` existentes; demais: `/` e `os.homedir()`); `listarPastas(caminho: string, ler?: (c: string) => Dirent[]): { caminho: string; pai: string | null; pastas: { nome: string; caminho: string }[] }`; `criarPasta(caminhoPai: string, nome: string): { caminho: string }`. Rotas: `GET /api/sistema/pastas?caminho=` (sem `caminho` → `{ caminho: null, pai: null, pastas: [], raizes }`; com → listagem + `raizes`); `POST /api/sistema/pastas` `{ caminhoPai, nome }` → 201.

- [ ] **Step 1: Testes que falham**

```ts
test("lista só subpastas, sem ocultas, em ordem", ...); // cria "b", "A", ".oculta", "$Recycle.Bin", "System Volume Information", arquivo.txt → ["A", "b"]
test("pai da raiz é null", ...);
test("caminho relativo → 400 'Informe um caminho absoluto'", ...);
test("sem permissão → 403 'Sem permissão para abrir esta pasta'", () => {
  const ler = () => { throw Object.assign(new Error("x"), { code: "EPERM" }); };
  assert.throws(() => listarPastas(tmp, ler), (e) => e instanceof ErroAplicacao && e.status === 403);
});
test("pasta inexistente → 404 'Pasta não encontrada'", ...);
test("criar pasta com nome inválido → 400; já existente → 409 'Já existe uma pasta com esse nome'", ...);
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — `readdirSync(caminho, { withFileTypes: true })`; ignorar nomes iniciados por `.` ou `$` e `System Volume Information`; entradas que lançam ao inspecionar são puladas; ordenar com `localeCompare(…, "pt-BR", { sensitivity: "base" })`; EACCES/EPERM → 403; ENOENT → 404.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Navegador de pastas para escolher a workspace"`

---

### Task 8: Fila de tarefas e eventos

**Files:**
- Create: `src/tarefas/tipos.ts`, `src/tarefas/fila.ts`, `src/tarefas/eventos.ts`, `testes/servidor/fila.test.ts`
- Modify: `src/banco/banco.ts` (tabela `tarefas`, índice em `status`)

**Interfaces:**
- Produces:
  - `tipos.ts`: `type TipoTarefa = "propor_planejamento" | "gerar_roteiro" | "refazer_roteiro" | "verificar_continuidade" | "propor_atualizacao_dossie" | "mover_workspace"`; `type StatusTarefa = "na_fila" | "executando" | "concluida" | "falhou" | "cancelada"`; `interface Tarefa { id: number; tipo: TipoTarefa; chave: string; projetoId: number | null; capituloNumero: number | null; parametros: Record<string, unknown>; status: StatusTarefa; progresso: number; mensagem: string; resultado: unknown | null; erro: string | null; criadaEm: string; iniciadaEm: string | null; concluidaEm: string | null }`; `interface ContextoExecucao { relatarProgresso(porcentagem: number, mensagem: string): void; sinal: AbortSignal }`; `type Executor = (tarefa: Tarefa, contexto: ContextoExecucao) => Promise<unknown>`.
  - `eventos.ts`: `type Evento = { tipo: "tarefa"; dados: Tarefa } | { tipo: "sistema"; dados: StatusSistema }`; `emitirEvento(evento: Evento): void`; `assinarEventos(ouvinte: (evento: Evento) => void): () => void`.
  - `fila.ts`: `registrarExecutor(tipo: TipoTarefa, executor: Executor): void`; `criarTarefa(dados: { tipo: TipoTarefa; projetoId: number | null; capituloNumero: number | null; parametros?: Record<string, unknown> }): Tarefa`; `buscarTarefa(id: number): Tarefa | null`; `listarTarefas(filtro?: { projetoId?: number; status?: StatusTarefa[] }): Tarefa[]` (id decrescente, até 100); `cancelarTarefa(id: number): Tarefa`; `repetirTarefa(id: number): Tarefa`; `prepararFilaAoIniciar(): void`; `iniciarFila(): void`; `pararFila(): Promise<void>`; `aguardarFilaOciosa(): Promise<void>` (para testes).

- [ ] **Step 1: Testes que falham**

```ts
test("executa em ordem, uma por vez", async () => { /* executor registra início/fim com atraso; 3 tarefas; ordem de execução = ordem de criação e nunca 2 ao mesmo tempo */ });
test("chave duplicada na fila → 409 'Já existe uma tarefa para isso'", ...); // chave = `${tipo}:${projetoId ?? "-"}:${capituloNumero ?? "-"}`
test("concluída guarda resultado e progresso 100", ...);
test("ErroAplicacao → falhou com a mensagem", ...);
test("cancelar na fila → cancelada sem executar", ...);
test("cancelar em execução aborta o sinal → cancelada", ...);
test("repetir cria tarefa nova com os mesmos parâmetros (só de falhou/cancelada; senão 409)", ...);
test("ao iniciar: executando vira falhou com 'Interrompida: o servidor foi fechado durante a execução'", ...);
test("ao iniciar: status final há mais de 30 dias é apagado; na_fila continua", ...);
test("cada mudança emite evento 'tarefa'", ...);
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — `criarTarefa` acorda a fila; laço pega a `na_fila` de menor `id`; `AbortController` por execução; cancelar em execução marca `cancelada` mesmo que o executor termine; `relatarProgresso` grava no banco se ele estiver aberto (durante `mover_workspace` o banco fica fechado: só emite o evento); erro não `ErroAplicacao` → `falhou` com a mensagem original e log.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Fila de tarefas em segundo plano com eventos"`

---

### Task 9: Rotas de tarefas, SSE e monitor do sistema

**Files:**
- Create: `src/servidor/rotasTarefas.ts`, `src/sistema/monitor.ts`, `testes/servidor/rotasTarefas.test.ts`
- Modify: `src/servidor/app.ts` (`prepararFilaAoIniciar`, `iniciarFila`, `iniciarMonitorSistema` ao criar; `onClose` para tudo e chama `fecharBanco`)

**Interfaces:**
- Consumes: fila e eventos (Tarefa 8), `obterStatusSistema` (Tarefa 5).
- Produces: rotas `GET /api/tarefas?projetoId=&status=a,b`, `GET /api/tarefas/:id` (404 "Tarefa não encontrada"), `POST /api/tarefas/:id/cancelar`, `POST /api/tarefas/:id/repetir` (202 `{ tarefaId }`), `GET /api/eventos`; `iniciarMonitorSistema(intervaloMs = 15000): void`, `pararMonitorSistema(): void`.

- [ ] **Step 1: Testes que falham**

```ts
test("lista e filtra por status e projeto", ...);
test("SSE entrega event: tarefa ao criar uma tarefa", async () => {
  const app = await criarApp(...); await app.listen({ port: 0, host: "127.0.0.1" });
  const r = await fetch(`http://127.0.0.1:${porta}/api/eventos`, { headers: { host: `localhost:${porta}` } });
  // cria tarefa; lê o corpo até achar "event: tarefa\ndata: {" com o id criado
});
test("monitor emite 'sistema' só quando o status muda", ...); // intervalo 50 ms; apagar o marcador → 1 evento com workspace.disponivel === false
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — SSE com `reply.hijack()`; cabeçalhos `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`; envia `retry: 3000`; cada evento `event: {tipo}\ndata: {json}\n\n`; comentário `: ping\n\n` a cada 20 s; ao fechar a conexão, cancela a assinatura.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Rotas de tarefas, eventos SSE e monitor do sistema"`

---

### Task 10: Mover a workspace

**Files:**
- Create: `src/workspace/mover.ts`, `testes/servidor/mover.test.ts`
- Modify: `src/servidor/rotasWorkspace.ts`, `src/servidor/app.ts` (registra executor `mover_workspace`)

**Interfaces:**
- Consumes: `copiarConferindo`, `medirPasta` (Tarefa 6); `definirMovendo`, `estadoWorkspace` (Tarefa 5); `ContextoExecucao` (Tarefa 8).
- Produces: `moverWorkspace(destino: string, contexto: ContextoExecucao, dependencias?: { renomear?: typeof renameSync; copiar?: typeof copiarConferindo }): Promise<{ caminho: string }>`; rota `POST /api/workspace/mover` `{ destino }` → 202 `{ tarefaId }` (valida antes de enfileirar).

- [ ] **Step 1: Testes que falham**

```ts
test("mesmo disco: renomeia e grava o novo caminho", ...); // novo = join(destino, "Gangoy-workspace"); configuracao-local aponta para ele; banco reaberto funciona
test("EXDEV: copia, confere e apaga a origem", ...); // renomear injetado lança { code: "EXDEV" }
test("falha no meio da cópia: destino removido, origem válida e banco reaberto na origem", ...);
test("destino com outra workspace → 409 'O destino já tem uma workspace'", ...);
test("espaço livre insuficiente → 409 'Espaço livre insuficiente no destino'", ...); // injeta statfs pequeno via dependências se necessário
test("rotas de dados respondem 503 durante a mudança", ...);
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — passos da spec §5 "Mudar a workspace de lugar": exige 110% do tamanho em `statfs`; `definirMovendo(true)` → `fecharBanco()` → renomear → (EXDEV) copiar + `rmSync(origem, { recursive: true })` → `salvarConfiguracaoLocal` → `abrirBanco` → `definirMovendo(false)`; mensagens de progresso "Copiando arquivos ({n} de {total})".
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Mudança de local da workspace com conferência"`

---

### Task 11: Ollama falso e proteção do contexto no cliente

**Files:**
- Create: `src/ollama/contexto.ts`, `testes/apoio/ollamaFalso.ts`, `testes/apoio/respostasOllama.ts`, `testes/servidor/contexto.test.ts`
- Modify: `src/ollama/ollama.ts`, chamadores (`roteiro.ts`, `planejamento.ts`, `continuidade.ts`, `dossie/atualizacao.ts`) passam a usar `.dados`

**Interfaces:**
- Consumes: `obterConfiguracoesSistema`, `lerConfiguracao`/`salvarConfiguracao` (`amostras_fator_tokens`).
- Produces:
  - `contexto.ts`: `type TipoChamada = "roteiro" | "refazer" | "planejamento" | "continuidade" | "proposta_dossie"`; `RESERVA_RESPOSTA: Record<TipoChamada, number>` (6000, 6000, 4000, 2000, 2000); `estimarTokens(caracteres: number, fator: number): number` (= `Math.ceil(caracteres / fator)`); `obterFatorTokens(): number` (média das amostras, limitada a 2,0–5,0; sem amostras → 3,0); `registrarAmostraTokens(caracteres: number, tokensReais: number): void` (guarda as últimas 20); `class ErroContextoInsuficiente extends ErroAplicacao { tokensNecessarios: number; numCtx: number }` (status 422; mensagem "O pedido precisa de ~{N} tokens e o contexto de trabalho é {M}. Aumente o contexto em Configurações ou escolha um modelo com contexto maior.", números com `toLocaleString("pt-BR")`).
  - `ollama.ts`: `interface MedicaoContexto { modelo: string; numCtx: number; tokensEstimados: number; tokensPrompt: number; tokensResposta: number; possivelCorte: boolean; percentualCpu: number | null; duracaoSegundos: number }`; `gerarJsonIa<T extends z.ZodType>(modelo: string, mensagens: Mensagem[], esquema: T, opcoes: { tipo: TipoChamada; sinal?: AbortSignal; tentativas?: number }): Promise<{ dados: z.infer<T>; medicao: MedicaoContexto }>`; `ultimoPercentualCpu(modelo: string): number | null`.
  - `ollamaFalso.ts`: `iniciarOllamaFalso(opcoes?: { modelos?: { nome: string; contextoMaximo: number; tamanho?: number; tamanhoVram?: number }[]; responderChat?: (corpo: CorpoChatFalso) => { conteudo: unknown; promptEvalCount?: number; atrasoMs?: number } }): Promise<{ url: string; pedidos: CorpoChatFalso[]; definir(o: Partial<typeof opcoes>): void; fechar(): Promise<void> }>` — atende `/api/version`, `/api/tags`, `/api/show`, `/api/chat`, `/api/ps`. Padrão de `responderChat`: `respostaPadraoOllama` de `respostasOllama.ts`, que escolhe pelo esquema em `format.properties` (`cenas` → roteiro de 1.200 palavras em 8 cenas; `esbocos` → planejamento com 2 personagens e 3 capítulos; `problemas` → `{ problemas: [] }`; `resumoCapitulo` → atualização com 1 fato).

- [ ] **Step 1: Testes que falham**

```ts
test("toda chamada envia num_ctx e num_predict", async () => { await gerarJsonIa("gemma4:12b-it-qat", msgs, esquema, { tipo: "roteiro" }); assert.equal(falso.pedidos[0].options.num_ctx, 32768); assert.equal(falso.pedidos[0].options.num_predict, 6000); });
test("pedido que não cabe → ErroContextoInsuficiente antes de chamar", async () => { /* contexto_trabalho 4096, mensagem de 40.000 caracteres */ await assert.rejects(..., ErroContextoInsuficiente); assert.equal(falso.pedidos.length, 0); });
test("prompt_eval_count perto do limite marca possivelCorte", ...); // promptEvalCount = 32768 - 6000 → true
test("calibra o fator com a média das amostras", ...); // 20 amostras de 3,5 → obterFatorTokens() === 3.5
test("mede a fração em CPU por /api/ps", ...); // tamanho 10, tamanhoVram 7 → percentualCpu 30
test("cancelamento pelo sinal aborta o fetch", ...);
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — estimativa sobre a soma dos `content` do histórico, conferida a cada tentativa (o reenvio cresce o histórico); `possivelCorte = prompt_eval_count >= numCtx - reserva`; depois da resposta, `registrarAmostraTokens` e consulta a `/api/ps` (falha silenciosa → `null`); `duracaoSegundos` medido com `performance.now()`. URL do Ollama vem de `obterOpcoesExecucao().urlOllama`. Ollama inacessível → `ErroAplicacao("O Ollama não está respondendo em {url}", 503)` (substitui a mensagem atual).
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Contexto do Ollama sempre informado, conferido e medido"`

---

### Task 12: Modelos do Ollama, configurações do sistema e `teste:ollama`

**Files:**
- Create: `src/ollama/modelos.ts`, `src/servidor/rotasConfiguracoes.ts`, `scripts/testeOllama.ts`, `testes/servidor/modelos.test.ts`
- Modify: `src/projetos/projetos.ts` (`modeloOllama` vazio = padrão; `criarProjeto` não preenche mais o padrão), `package.json` (`"teste:ollama": "tsx scripts/testeOllama.ts"`)

**Interfaces:**
- Consumes: `ultimoPercentualCpu` (Tarefa 11), `obterConfiguracoesSistema`/`salvarConfiguracao` (Tarefa 3).
- Produces:
  - `interface ModeloOllama { nome: string; tamanhoBytes: number; parametros: string; quantizacao: string; contextoMaximo: number | null; capacidades: string[]; percentualCpu: number | null }`; `listarModelos(): Promise<ModeloOllama[]>` (cache de `/api/show` por nome, refeito quando a lista de `/api/tags` muda); `normalizarNomeModelo(nome: string): string` (sem `:` → `:latest`); `garantirModeloInstalado(nome: string): Promise<string>` (422 "O modelo {nome} não está instalado no Ollama. Escolha outro em Configurações."); `resolverModelo(tipo: "principal" | "leve", opcoes?: { modeloProjeto?: string; modeloEscolhido?: string }): string` (escolhido > projeto (só principal) > sistema).
  - Rotas: `GET /api/ollama/modelos` → `ModeloOllama[]`; `GET /api/configuracoes` → `{ modeloPrincipal, modeloLeve, contextoTrabalho }`; `PUT /api/configuracoes` (parcial).

- [ ] **Step 1: Testes que falham**

```ts
test("lista modelos com contexto máximo de model_info", ...); // falso: gemma4:12b-it-qat contextoMaximo 262144
test("nome sem tag casa com :latest", async () => { /* falso lista "qwen3.6:latest" */ assert.equal(await garantirModeloInstalado("qwen3.6"), "qwen3.6:latest"); });
test("modelo ausente → 422 com a mensagem", ...);
test("precedência: escolhido > projeto > sistema; leve ignora o projeto", ...);
test("PUT contexto acima do máximo do modelo → 400 'O modelo {m} aceita no máximo {n} tokens de contexto'", ...);
test("PUT contexto abaixo de 4096 → 400", ...);
test("PUT com Ollama fora do ar → 503 'O Ollama não está respondendo em {url}'", ...);
test("projeto criado sem modelo fica vazio e segue o padrão", ...);
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — `contextoMaximo` = primeira chave de `model_info` que termina em `.context_length`. `scripts/testeOllama.ts`: usa o Ollama real (`app.json`), o modelo principal e o contexto configurados na workspace atual (ou os padrões se não houver), faz uma chamada curta de planejamento e imprime: modelo, `num_ctx`, `prompt_eval_count`, tempo em segundos e "100% na GPU" ou "{n}% na CPU".
- [ ] **Step 4: Rodar e ver passar** — `npm test` PASS; `npm run teste:ollama` roda até o fim com o Ollama local (anotar a saída para o relatório final).
- [ ] **Step 5: Commit** — `git commit -m "Seleção de modelos do Ollama e configurações do sistema"`

---

### Task 13: Tarefas de história na fila e metadados das versões

**Files:**
- Create: `src/tarefas/executoresHistoria.ts`, `testes/servidor/historia.test.ts`
- Modify: `src/roteiro/roteiro.ts`, `src/planejamento/planejamento.ts`, `src/continuidade/continuidade.ts`, `src/dossie/atualizacao.ts`, `src/capitulos/capitulos.ts` (campos novos em `VersaoRoteiro`), `src/servidor/rotasHistoria.ts`

**Interfaces:**
- Consumes: `criarTarefa`, `registrarExecutor`, `ContextoExecucao`; `gerarJsonIa` (Tarefa 11); `resolverModelo`, `garantirModeloInstalado` (Tarefa 12).
- Produces:
  - `VersaoRoteiro` ganha campos opcionais `modelo?: string; duracaoGeracaoSegundos?: number; contexto?: { numCtx: number; tokensPrompt: number; tokensResposta: number; possivelCorte: boolean; percentualCpu: number | null }`.
  - Funções de domínio com último parâmetro `contexto?: ContextoExecucao` e opção `modelo?: string`: `proporPlanejamento(projetoId, enredo, opcoes?)`, `gerarRoteiroCapitulo(projetoId, numero, opcoes?)`, `refazerRoteiroCapitulo(projetoId, numero, instrucao, opcoes?)`, `verificarContinuidade(projetoId, numero, opcoes?)`, `proporAtualizacaoDossie(projetoId, numero, opcoes?)` — `opcoes = { modelo?: string; contexto?: ContextoExecucao }`.
  - `registrarExecutoresHistoria(): void`. Resultado das tarefas: planejamento → `Planejamento`; roteiro/refazer → `{ versao: number }`; continuidade → `{ aprovado: boolean; problemas: … }`; proposta → `Atualizacao`.
  - Rotas lentas → 202 `{ tarefaId }`: `POST …/planejamento` `{ enredo }`; `…/capitulos/:n/roteiro` `{ modelo? }`; `…/refazer` `{ instrucao, modelo? }`; `…/continuidade` `{ modelo? }`; `…/proposta-dossie`. `GET …/versoes` passa a incluir `modelo`, `duracaoGeracaoSegundos`, `contexto`.

- [ ] **Step 1: Testes que falham** (com `iniciarOllamaFalso`)

```ts
test("fluxo pela fila: planejar → confirmar → gerar → refazer → continuidade → propor → aprovar", ...); // cada POST lento → 202; aguardarFilaOciosa(); status final concluida
test("validação rápida volta na hora, sem criar tarefa", ...); // enredo curto → 400 "Descreva o enredo com pelo menos 20 caracteres"; refazer sem instrução → 400
test("versão guarda modelo, tempo e contexto", ...); // roteiro_v1.json tem modelo "gemma4:12b-it-qat", contexto.numCtx 32768
test("modelo escolhido na geração é usado", ...); // { modelo: "qwen3.6" } → pedido ao falso com model "qwen3.6:latest"
test("sem espaço para o texto integral do capítulo anterior, usa o resumo", ...); // capítulo 2 com anterior enorme; contexto 8192; pedido contém "Resumo do capítulo 1 (o texto integral não coube no contexto):"
test("nem com o resumo cabe → tarefa falhou com a mensagem de contexto", ...);
test("progresso: 'Gerando roteiro' e, na ampliação, 'Ampliando o texto'", ...);
test("workspace some durante a geração → falhou com 'Workspace não encontrada em'", ...); // falso com atrasoMs 300; apaga o marcador durante o atraso
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — rotas fazem as checagens rápidas atuais (projeto existe, capítulo existe, enredo ≥ 20, instrução não vazia, roteiro existe para refazer/continuidade/proposta) antes de `criarTarefa`. Modelo: `garantirModeloInstalado(resolverModelo(...))` no início de cada executor. Roteiro: primeira tentativa com o texto integral do anterior; se lançar `ErroContextoInsuficiente`, refaz as mensagens com `Resumo do capítulo {n-1} (o texto integral não coube no contexto):\n{resumo}` (de `resumosCapitulos`, senão do esboço); se lançar de novo, propaga. Progresso: 10 "Preparando o contexto", 30 "Gerando roteiro", 70 "Ampliando o texto" (quando houver), 95 "Salvando a versão". Metadados: medição da última chamada, `duracaoGeracaoSegundos` somando as chamadas, `possivelCorte` verdadeiro se qualquer chamada marcou.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Planejamento, roteiro, continuidade e dossiê pela fila de tarefas"`

---

### Task 14: Pendências de revisão

**Files:**
- Create: `src/revisao/revisao.ts`, `testes/servidor/revisao.test.ts`
- Modify: `src/servidor/rotasHistoria.ts`

**Interfaces:**
- Produces: `interface ItemRevisao { tipo: "roteiro_para_aprovar" | "proposta_dossie_pronta"; projetoId: number; capituloNumero: number; titulo: string; desde: string; tarefaId: number | null }`; `listarPendencias(projetoId?: number): ItemRevisao[]`; rota `GET /api/revisao?projetoId=` → `{ itens }`.

- [ ] **Step 1: Testes que falham** — capítulo `roteiro_gerado` aparece como `roteiro_para_aprovar` (desde = `criadoEm` da última versão); tarefa `propor_atualizacao_dossie` concluída de capítulo não aprovado aparece como `proposta_dossie_pronta` com `tarefaId`; depois de aprovar, os dois somem; ordem por `desde` crescente.
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** `listarPendencias`.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Lista de pendências de revisão"`

---

### Task 15: Base da interface Vue, temas e testes de interface

**Files:**
- Create: `interface/index.html`, `interface/vite.config.ts`, `interface/tsconfig.json`, `interface/src/main.ts`, `interface/src/App.vue`, `interface/src/rotas.ts`, `interface/src/estilos/temas.css`, `interface/src/estilos/base.css`, `interface/src/estado/usarTema.ts`, `interface/src/componentes/MenuLateral.vue`, `interface/src/componentes/TrocaTema.vue`, `interface/src/telas/*.vue` (8 telas com título e "Em construção"), `playwright.config.ts`, `scripts/servidorTeste.ts`, `testes/interface/tema.spec.ts`
- Modify: `package.json`, `src/servidor/app.ts` (servir `interface/dist` e devolver `index.html` para rotas que não são `/api`), `.gitignore` (`interface/dist/`, `test-results/`, `playwright-report/`)

**Interfaces:**
- Produces:
  - Scripts: `"dev": "concurrently -n servidor,interface \"tsx watch src/servidor/servidor.ts\" \"vite --config interface/vite.config.ts\""`, `"construir:interface": "vite build --config interface/vite.config.ts"`, `"iniciar": "npm run construir:interface && tsx src/servidor/servidor.ts"`, `"verificar": "tsc --noEmit && vue-tsc --noEmit -p interface/tsconfig.json"`, `"teste:interface": "playwright test"`.
  - Rotas da interface: `/` → `/producao`, `/boas-vindas`, `/producao`, `/producao/planejamento`, `/capitulos/:numero`, `/revisao`, `/dossie`, `/projetos`, `/configuracoes`.
  - `usarTema(): { tema: Ref<"escuro" | "claro">; alternar(): void }` — `localStorage["gangoy.tema"]`, padrão `escuro`, aplica `document.documentElement.dataset.tema`.
  - `scripts/servidorTeste.ts`: sobe `iniciarOllamaFalso()` e `criarApp({ porta: 3100, pastaDados: <temporária>, urlOllama })`; rotas só deste script: `POST /__teste/reiniciar` `{ comWorkspace: boolean }` (fecha o banco, recria pastas temporárias, cria a workspace se pedido) e `POST /__teste/ollama` (repassa a `definir()` do falso, ex.: `{ atrasoMs }`).
  - `playwright.config.ts`: `use: { channel: "chrome", baseURL: "http://127.0.0.1:3100" }`, `workers: 1`, `fullyParallel: false`, `webServer: { command: "npm run construir:interface && tsx scripts/servidorTeste.ts", url: "http://127.0.0.1:3100/api/configuracoes/app", reuseExistingServer: false }`, `testDir: "testes/interface"`.

- [ ] **Step 1: Instalar as dependências da interface** — `npm install vue@^3.5.43 vue-router@^5.3.1` e `npm install -D vite@^8.3.3 @vitejs/plugin-vue@^6.0.9 vue-tsc@^3.3.12 concurrently@^10.0.5 @playwright/test@^1.63.0`.

- [ ] **Step 2: Teste de interface que falha** (`testes/interface/tema.spec.ts`)

```ts
test("tema escuro por padrão; troca para claro e continua após recarregar", async ({ page, request }) => {
  await request.post("/__teste/reiniciar", { data: { comWorkspace: true } });
  await page.goto("/producao");
  await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
  await page.getByRole("button", { name: "☀ Claro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "claro");
});
test("menu lateral tem Produção, Revisão, Dossiê, Projetos e Configurações", ...);
```
- [ ] **Step 3: Rodar e ver falhar** — `npm run teste:interface` · FAIL.
- [ ] **Step 4: Implementar** — Vite com `root: "interface"`, `build.outDir: "dist"`, `server.port: 5173`, `server.proxy: { "/api": "http://127.0.0.1:3000" }`. `temas.css` com as variáveis da spec §6 (escuro: fundo `#0f1218`, menu `#0b0d12`, cartões `#1b2030`, destaque `#3b82f6`; claro: menu `#141821`, fundo `#f3f4f7`, cartões `#ffffff`, destaque `#2563eb`) e demais tons das maquetes `estilo-visual-v2.html`. MenuLateral conforme a maquete (item ativo com marca azul; troca de tema no rodapé com os botões "☾ Escuro" e "☀ Claro").
- [ ] **Step 5: Rodar e ver passar** — `npm run teste:interface`, `npm run verificar`, `npm test`: PASS.
- [ ] **Step 6: Commit** — `git commit -m "Base da interface Vue com temas e testes de interface"`

---

### Task 16: Cliente da API, eventos ao vivo e barra do topo

**Files:**
- Create: `interface/src/api/cliente.ts`, `interface/src/api/eventos.ts`, `interface/src/api/tipos.ts`, `interface/src/estado/usarProjetoAtual.ts`, `interface/src/estado/usarTarefas.ts`, `interface/src/estado/usarStatusSistema.ts`, `interface/src/componentes/BarraTopo.vue`, `SeletorProjeto.vue`, `IndicadorFila.vue`, `Aviso.vue`, `DialogoConfirmacao.vue`, `BarraProgresso.vue`, `testes/interface/fila.spec.ts`
- Modify: `interface/src/App.vue`, `interface/src/rotas.ts` (guarda: workspace não configurada → `/boas-vindas`)

**Interfaces:**
- Produces:
  - `tipos.ts`: cópias manuais (sem importar de `src/`) de `Projeto`, `Capitulo`, `Tarefa`, `VersaoRoteiro`, `Dossie`, `Planejamento`, `Atualizacao`, `StatusSistema`, `ModeloOllama`, `ItemRevisao`.
  - `chamarApi<T>(caminho: string, opcoes?: { metodo?: "GET" | "POST" | "PUT" | "DELETE"; corpo?: unknown }): Promise<T>` (erro → `Error` com a mensagem de `{ erro }`).
  - `aoEvento(tipo: "tarefa" | "sistema", ouvinte: (dados) => void): () => void`; `aoReconectar(ouvinte: () => void): () => void` (um `EventSource` único em `/api/eventos`).
  - `usarProjetoAtual(): { projetos: Ref<Projeto[]>; projetoAtualId: Ref<number | null>; recarregar(): Promise<void> }` (`localStorage["gangoy.projetoAtual"]`).
  - `usarTarefas(): { tarefas: Ref<Tarefa[]>; recarregar(): Promise<void>; ativaDoCapitulo(projetoId: number, numero: number): Tarefa | null; aguardar(id: number): Promise<Tarefa> }` — carrega `GET /api/tarefas` ao montar e ao reconectar; aplica eventos.
  - `usarStatusSistema(): { status: Ref<StatusSistema | null> }`.
  - `avisar(texto: string, tipo?: "sucesso" | "erro"): void`; `confirmar(opcoes: { titulo: string; texto: string; botao: string }): Promise<boolean>`.

- [ ] **Step 1: Testes de interface que falham** (`fila.spec.ts`)

```ts
test("indicador mostra 'Fila: 1 executando · 0 aguardando' durante uma tarefa", ...); // /__teste/ollama { atrasoMs: 3000 }; cria projeto e enfileira planejamento via request
test("recarregar a página com tarefa em execução mantém o indicador", async ({ page }) => { /* idem; page.reload(); expect indicador ainda 'Fila: 1 executando' */ });
test("aviso 'Tarefa concluída' ao terminar", ...);
test("status do Ollama aparece como ponto verde com título 'Ollama online'", ...);
```
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — BarraTopo: SeletorProjeto, IndicadorFila (texto `Fila: {n} executando · {m} aguardando`; clique abre lista com "Cancelar" e "Tentar de novo"), pontos de status do Ollama e da workspace; aviso fixo quando `workspace.disponivel === false`: "Workspace não encontrada em {caminho}" com "Tentar de novo" e "Apontar outro local".
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Cliente da API, eventos ao vivo e barra do topo"`

---

### Task 17: Boas-vindas e navegador de pastas

**Files:**
- Create: `interface/src/componentes/NavegadorPastas.vue`, `testes/interface/boasVindas.spec.ts`
- Modify: `interface/src/telas/TelaBoasVindas.vue`

**Interfaces:**
- Consumes: `GET/POST /api/sistema/pastas`, `POST /api/workspace`, `POST /api/workspace/apontar`.
- Produces: `NavegadorPastas` com prop `modelValue: string | null` e evento `update:modelValue`; mostra raízes, subpastas, "Voltar", "Nova pasta".

- [ ] **Step 1: Teste que falha** — sem workspace, `/producao` redireciona para `/boas-vindas`; navegar até a pasta temporária do teste, "Nova pasta" "Meus Vídeos", "Usar esta pasta" → vai para `/producao` e o status mostra o caminho terminando em `Gangoy-workspace`; texto de aviso "Evite pastas de rede (compartilhamentos do Windows, NAS): o banco de dados pode corromper." visível.
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — botões "Usar esta pasta" (POST `/api/workspace`) e "Abrir workspace existente" (POST `/api/workspace/apontar`); texto "Os projetos que já existem em dados/ serão trazidos para a workspace." quando `status.existemDadosAntigos` for verdadeiro (Tarefa 6).
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Tela de boas-vindas com escolha da workspace"`

---

### Task 18: Projetos

**Files:**
- Create: `interface/src/componentes/SeletorModelo.vue`, `interface/src/componentes/PainelLateral.vue`, `testes/interface/projetos.spec.ts`
- Modify: `interface/src/telas/TelaProjetos.vue`

**Interfaces:**
- Consumes: `/api/projetos` (GET, POST, PUT, DELETE), `/api/ollama/modelos`.
- Produces: `SeletorModelo` com props `modelValue: string`, `permitirPadrao: boolean`, `rotuloPadrao: string` (ex.: "Padrão do sistema (gemma4:12b-it-qat)"); valor `""` = padrão.

- [ ] **Step 1: Teste que falha** — projeto com modelo que não está na lista do Ollama mostra no cartão "Modelo não instalado: {nome}"; criar projeto "Fábulas" pelo painel lateral; aparece em cartão com a inicial "F"; editar a duração para 6; duração 12 mostra "A duração máxima é 10 minutos"; excluir pede confirmação com o texto "A pasta do projeto vai para a lixeira da workspace (.lixeira) e pode ser recuperada." e some da lista.
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — cartões com inicial colorida, temática, canal, duração e modelo; criar/editar no PainelLateral; campos do formulário atual; ID do canal com sugestões dos canais conectados.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Tela de projetos com painel lateral e seletor de modelo"`

---

### Task 19: Configurações

**Files:**
- Create: `testes/interface/configuracoes.spec.ts`
- Modify: `interface/src/telas/TelaConfiguracoes.vue`

**Interfaces:**
- Consumes: `/api/configuracoes` (GET/PUT), `/api/ollama/modelos`, `/api/configuracoes/youtube`, `/api/youtube/contas`, `/api/youtube/oauth/iniciar`, `/api/workspace/mover`, `/api/workspace/apontar`, `/api/workspace/dados-antigos`, `/api/sistema/status`.

- [ ] **Step 1: Teste que falha** — seções Workspace, Modelos, YouTube e Ollama visíveis; trocar o modelo principal e o contexto para 16384 e salvar persiste após recarregar; contexto acima do máximo mostra a mensagem do servidor; salvar Client ID e Secret mostra "Client Secret salvo" e o campo do segredo volta vazio; o botão "Apagar dados antigos já convertidos" só aparece quando `GET /api/workspace/dados-antigos` tem itens e pede confirmação listando nome e tamanho.
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — Workspace (caminho, espaço livre, "Mudar local" com NavegadorPastas → tarefa com progresso, "Apontar outro local", "Apagar dados antigos já convertidos"); Modelos (principal, leve com SeletorModelo sem opção padrão; contexto de trabalho com o máximo do modelo principal ao lado; aviso "{modelo}: {n}% na CPU (mais lento). Reduza o contexto ou use um modelo menor." quando `percentualCpu > 0`); YouTube (credenciais + canais conectados, Conectar/Desconectar, texto sobre usuário de teste e upload privado); Ollama (endereço, versão, modelos instalados com tamanho, parâmetros, quantização e contexto máximo).
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Tela de configurações"`

---

### Task 20: Quadro de produção e planejamento

**Files:**
- Create: `interface/src/componentes/ColunaQuadro.vue`, `interface/src/componentes/CartaoCapitulo.vue`, `interface/src/componentes/EditorLista.vue`, `interface/src/estado/colunasQuadro.ts`, `testes/interface/producao.spec.ts`
- Modify: `interface/src/telas/TelaProducao.vue`, `interface/src/telas/TelaPlanejamento.vue`

**Interfaces:**
- Produces: `colunaDoCapitulo(capitulo: Capitulo, tarefaAtiva: Tarefa | null): "planejado" | "roteiro" | "roteiro_aprovado"` (regra da spec §6 item 2); `COLUNAS: { id: string; titulo: string }[]` = Planejado, Roteiro, Roteiro aprovado; `EditorLista` com `modelValue: T[]`, slot por item, botões "Adicionar", "Remover", "Subir", "Descer".

- [ ] **Step 1: Teste que falha** — projeto sem capítulos mostra "Planejar história"; escrever o enredo → "Propor planejamento" → formulário com sinopse, mundo, 2 personagens e 3 capítulos (respostas do Ollama falso); remover um capítulo e confirmar → quadro com 2 cartões em "Planejado"; "Gerar roteiro" num cartão (com `atrasoMs`) → cartão vai para "Roteiro" com barra de progresso e depois fica em "Roteiro" com "Aguardando aprovação".
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — layout da maquete `layout.html` opção C / `estilo-visual-v2.html`; cartão: "Cap. {n} · {título}", status, barra da tarefa ativa; clique abre `/capitulos/:numero`.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Quadro de produção e planejamento por formulário"`

---

### Task 21: Tela do capítulo

**Files:**
- Create: `testes/interface/capitulo.spec.ts`
- Modify: `interface/src/telas/TelaCapitulo.vue`

**Interfaces:**
- Consumes: `GET …/roteiro`, `GET …/versoes`, `POST …/roteiro|refazer|continuidade|proposta-dossie|aprovar`, `GET /api/tarefas/:id`.

- [ ] **Step 1: Teste que falha** — capítulo com roteiro mostra as cenas (narração, personagens, descrição visual), "Duração estimada: {x} min de {alvo} min"; seletor de versões mostra "v1 · gemma4:12b-it-qat · {s} s · Contexto: {a} mil de 32 mil"; "Refazer" com instrução e "Gerar com" outro modelo cria v2; "Verificar continuidade" mostra "Nenhum problema encontrado"; "Aprovar roteiro" → proposta com caixas de seleção; desmarcar o fato e confirmar → capítulo vai para "Roteiro aprovado" e o dossiê não tem o fato desmarcado; versão com `possivelCorte` mostra o alerta "Possível corte de contexto nesta versão".
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — contexto em amarelo acima de 80% de `numCtx`; ações desativadas enquanto há tarefa ativa do capítulo.
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Tela do capítulo com versões, continuidade e aprovação"`

---

### Task 22: Revisão e dossiê

**Files:**
- Create: `testes/interface/revisaoDossie.spec.ts`
- Modify: `interface/src/telas/TelaRevisao.vue`, `interface/src/telas/TelaDossie.vue`

**Interfaces:**
- Consumes: `GET /api/revisao`, `GET/PUT /api/projetos/:id/dossie`, `EditorLista`.

- [ ] **Step 1: Teste que falha** — Revisão lista "Cap. 1 · {título} — roteiro para aprovar" e o clique abre o capítulo; sem pendências mostra "Nada esperando por você."; Dossiê mostra as seções Sinopse, Mundo, Personagens, Fatos, Fios abertos, Linha do tempo, Esboços e Resumos; editar a aparência fixa e salvar persiste; "Ver JSON" com personagem sem nome ao salvar mostra "Personagens › item 1 › nome: campo obrigatório".
- [ ] **Step 2: Rodar e ver falhar** · FAIL.
- [ ] **Step 3: Implementar** — personagens em cartões (nome, papel, aparência fixa, traços com EditorLista).
- [ ] **Step 4: Rodar e ver passar** · PASS.
- [ ] **Step 5: Commit** — `git commit -m "Telas de revisão e dossiê"`

---

### Task 23: Finalização

**Files:**
- Create: `.github/workflows/testes.yml`, `README.md`
- Modify: `docs/superpowers/specs/2026-10-06-gangoy-videos-visao-geral-design.md` (subprojeto 1 concluído), `package.json` (`"engines": { "node": ">=22.12" }`)
- Delete: `public/` (todo)

- [ ] **Step 1: Workflow** — matriz `os: [windows-latest, ubuntu-latest]`, Node 22, passos `npm ci`, `npm run verificar`, `npm test`, `npm run teste:interface` (sem `playwright install`).
- [ ] **Step 2: README** — o que é; requisitos (Node 22.12+, Ollama, Google Chrome para os testes de interface); `npm install`, `npm run dev`, `npm run iniciar`, `npm test`, `npm run teste:interface`, `npm run teste:ollama`; link para as specs.
- [ ] **Step 3: Remover `public/`** e conferir `git grep -n "public/"` sem uso em `src/`.
- [ ] **Step 4: Verificação completa** — `npm run verificar`, `npm test`, `npm run teste:interface`, `npm run teste:ollama`: todos PASS; com `npm run iniciar`, abrir `http://localhost:3000`, criar a workspace numa pasta de teste e conferir que o "Léo e o Dragão" aparece com os 2 capítulos e os roteiros. Anotar no relatório final a saída do `teste:ollama` (fração em GPU com contexto 32768).
- [ ] **Step 5: Commit** — `git commit -m "Finalização do subprojeto 1: CI, README e remoção da interface antiga"`
