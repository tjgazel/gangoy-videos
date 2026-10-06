# Spec: Gangoy Vídeos — Subprojeto 1: base do sistema

Data: 2026-10-06 · Status: aguardando revisão

Este documento descreve o primeiro dos quatro subprojetos do replanejamento. A visão do produto, o glossário e os requisitos dos próximos subprojetos estão em [2026-10-06-gangoy-videos-visao-geral-design.md](2026-10-06-gangoy-videos-visao-geral-design.md). O andamento é acompanhado pelas caixas de seleção do plano de implementação em `docs/superpowers/plans/`.

## 1. Contexto e objetivo

As fases 1 e 2 do plano original estão prontas (projetos, dossiê, planejamento, roteiro, continuidade, refazer, OAuth). A interface atual é HTML e JavaScript puro em `public/`, os arquivos ficam em `dados/projetos/` e as chamadas ao Ollama seguram a resposta HTTP por minutos.

O objetivo do subprojeto 1 é deixar a base pronta para as fases de mídia, com:

- painel administrativo moderno (quadro de produção, tema escuro e claro);
- todos os arquivos em uma pasta de trabalho escolhida pelo usuário (`Gangoy-workspace`);
- tarefas longas em segundo plano, com progresso ao vivo;
- escolha de modelo do Ollama entre os já instalados e proteção do tamanho de contexto;
- funcionamento igual em Windows e Linux;
- testes automatizados.

### Critérios de sucesso

1. Na primeira execução, o usuário escolhe o local, o sistema cria `Gangoy-workspace` e traz o projeto "Léo e o Dragão" para dentro dela, com os roteiros já existentes.
2. Gerar um roteiro não trava a tela: o cartão do capítulo mostra o progresso no quadro e o usuário continua navegando.
3. Cada versão de roteiro mostra o modelo usado, o tempo e o contexto ocupado; nenhuma chamada ao Ollama é enviada sem `num_ctx`.
4. Os testes passam em Windows e em Linux, sem depender do Ollama real.

## 2. Divisão do replanejamento

| # | Subprojeto | Conteúdo |
|---|---|---|
| **1** | **Base do sistema (esta spec)** | Credenciais no banco · workspace · Windows/Linux · painel Vue · fila de tarefas · modelos e contexto · testes |
| 2 | Ferramentas e mídia | `npm run preparar` (downloads com confirmação, por sistema) · Piper · legenda · ComfyUI · render FFmpeg |
| 3 | Revisão do vídeo | Player com roteiro sincronizado · marcação por cena (imagem, narração, texto) · refazer só as marcadas · aprovação |
| 4 | Publicação e automação | Upload, legenda e playlist no YouTube · importação de obra completa · agenda |

## 3. Decisões tomadas

| Tema | Decisão |
|---|---|
| Credenciais do Google | Ficam no banco (fora do Git). A mudança para `.env` é desfeita. |
| Local dos arquivos | Uma workspace: o usuário escolhe um local e o sistema cria `<local>/Gangoy-workspace/`. Cada projeto é uma subpasta. Não há pasta por projeto fora da workspace. |
| Conteúdo da workspace | Projeto inteiro: dossiê, roteiros, mídia e o banco (`gangoy.db`). |
| Organização | Subpastas por capítulo e, dentro dele, por tipo de arquivo. |
| Mudar a workspace de lugar | Move tudo, com conferência; entre discos copia, confere e só depois apaga a origem. |
| Aprovações | Duas: roteiro (já existe) e vídeo final (subprojeto 3). |
| Estrutura do painel | Quadro de produção (kanban) como tela principal, menu lateral enxuto, seletor de projeto no topo. |
| Estilo | Tema escuro estilo estúdio com destaque azul (padrão) e tema claro híbrido (menu escuro, conteúdo claro), com botão de troca. |
| Revisão do vídeo | Player com roteiro sincronizado ao lado (subprojeto 3). |
| Ferramentas externas | Tudo em `ferramentas/` nos dois sistemas, baixado por comando de preparação com confirmação; usa a do sistema se já existir (subprojeto 2). |
| Interface | Vue 3 + Vite + TypeScript. |
| Nome "Dossiê" | Mantido na interface e no código. |

Maquetes aprovadas: geradas no brainstorming em `.superpowers/brainstorm/` (pasta local, fora do Git): `layout.html` (opção C), `estilo-visual-v2.html`, `revisao.html` (opção B).

## 4. Arquitetura e organização do código

O servidor continua em Node 22 + Fastify + SQLite (`node:sqlite`). A interface sai de `public/` e passa a ser um app Vue em `interface/`.

```
gangoy-videos/
  src/                          servidor
    servidor/                   criarApp(), rotas, tratador de erro, conferência de Host
    workspace/          (novo)  local da workspace, caminhos, navegador de pastas, mover, conversão
    tarefas/            (novo)  fila, registro de tipos, eventos (SSE)
    ollama/                     cliente, lista de modelos, contexto
    projetos/ dossie/ roteiro/ continuidade/ planejamento/ capitulos/ youtube/ configuracoes/
  interface/            (novo)  Vue 3 + Vite + TypeScript
    src/
      telas/                    TelaBoasVindas, TelaProducao, TelaPlanejamento, TelaCapitulo,
                                TelaRevisao, TelaDossie, TelaProjetos, TelaConfiguracoes
      componentes/              MenuLateral, BarraTopo, SeletorProjeto, IndicadorFila, TrocaTema,
                                ColunaQuadro, CartaoCapitulo, BarraProgresso, NavegadorPastas,
                                EditorLista, SeletorModelo, DialogoConfirmacao, Aviso
      api/                      cliente HTTP e assinatura de eventos
      estilos/temas.css         variáveis de cor dos dois temas
  testes/               (novo)  unitários e de API (node:test), interface (Playwright)
  .github/workflows/    (novo)  testes em windows-latest e ubuntu-latest
```

`public/` é removido quando todas as telas estiverem migradas.

### Execução

- `npm run dev`: servidor (porta 3000, recarrega ao salvar) e Vite (porta 5173, repassa `/api` para 3000), juntos via `concurrently`. Uso em `http://localhost:5173`.
- `npm run iniciar`: gera a interface (`interface/dist`) e o Fastify serve tudo em `http://localhost:3000`.
- `npm run verificar`: `tsc --noEmit` do servidor e `vue-tsc --noEmit` da interface.
- `npm test`: unitários e API. `npm run teste:interface`: Playwright. `npm run teste:ollama`: verificação manual com o Ollama real.

### Dependências novas

`vue`, `vue-router`, `vite`, `@vitejs/plugin-vue`, `vue-tsc`, `concurrently`, `@playwright/test`. Sem Pinia, Tailwind ou biblioteca de componentes: estado em funções `use...`, visual em CSS com variáveis.

### Mudanças no código existente

- `servidor.ts` passa a exportar `criarApp()` (sem `listen`), usado pelo servidor e pelos testes.
- Um tratador de erro central substitui os `try/catch` repetidos: `ErroAplicacao` → `{ erro }` com o status; `ZodError` → 400 com a primeira mensagem.
- `nucleo/caminhos.ts` passa a resolver tudo a partir da workspace.
- Rotas lentas passam a criar tarefas (seção 7).

## 5. Workspace e armazenamento

### Estrutura

```
<local escolhido>/Gangoy-workspace/
  .gangoy-workspace.json          identificação: { "versao": 1, "criadoEm": "..." }
  gangoy.db                       banco (projetos, capítulos, tarefas, configurações, contas)
  .lixeira/                       projetos excluídos: <slug>-<data>/
  <slug-do-projeto>/
    dossie.json
    personagens/<slug-do-personagem>/referencia.png
    capitulos/capitulo-001/
      roteiro/roteiro_v1.json, roteiro_v2.json ...
      imagens/                    (subprojeto 2)
      audio/cenas/, audio/narracao.wav
      legenda/legenda.srt
      video/video.mp4
```

- A pasta do projeto é sempre `<workspace>/<slug>`; o banco não guarda caminhos absolutos de projeto.
- As subpastas do capítulo são criadas quando o primeiro arquivo do tipo é gravado.
- Numeração do capítulo com três dígitos (`capitulo-001`).

### Configuração da máquina

`dados/configuracao-local.json` guarda só o que é desta máquina: `{ "pastaWorkspace": "<caminho absoluto>" }`. `dados/` continua no `.gitignore`. `configuracao/app.json` deixa de ter `caminhos.banco` e `caminhos.projetos`.

### Primeira execução

1. Sem `pastaWorkspace` configurada, a interface abre a TelaBoasVindas.
2. O usuário navega pelas pastas e escolhe um local (pode criar uma pasta nova ali).
3. Se o local escolhido **já é** uma workspace (tem `.gangoy-workspace.json`) ou contém `Gangoy-workspace/` com esse arquivo, o sistema reaproveita a existente. Caso contrário, cria `<local>/Gangoy-workspace/`.
4. Se criou uma nova e existe `dados/app.db` ou `dados/projetos/`, executa a conversão (abaixo).

### Conversão dos dados atuais

Executada uma vez, ao criar a workspace:

1. Faz `PRAGMA wal_checkpoint(TRUNCATE)` em `dados/app.db` e copia o arquivo para `Gangoy-workspace/gangoy.db`; aplica as mudanças de esquema da seção 9.
2. Para cada projeto em `dados/projetos/<slug>/`: copia `dossie.json` e converte `capitulos/NNN/versoes/roteiro_vK.json` em `capitulos/capitulo-NNN/roteiro/roteiro_vK.json`.
3. Confere a quantidade e o tamanho dos arquivos copiados; só então renomeia `dados/app.db` para `dados/app.db.migrado` e `dados/projetos` para `dados/projetos.migrado` (nada é apagado nesta etapa).
4. `dados/lixeira/` não é tocada.
5. Em Configurações › Workspace aparece "Apagar dados antigos já convertidos" enquanto existirem `dados/app.db.migrado` ou `dados/projetos.migrado`. O diálogo de confirmação lista o que será apagado e o tamanho; só apaga esses dois itens (nunca `dados/lixeira/` nem `configuracao-local.json`).

Se a conferência falhar, a workspace nova é desfeita (a cópia é removida) e a mensagem explica o motivo; os dados originais continuam no lugar.

### Mudar a workspace de lugar

Tarefa da fila do tipo `mover_workspace`, exclusiva (nenhuma outra tarefa roda junto):

1. Confere que o destino existe, permite escrita, não contém outra workspace e tem espaço livre de pelo menos 110% do tamanho atual (`fs.statfs`).
2. Fecha o banco.
3. Tenta `rename`. Se o sistema responder `EXDEV` (outro disco), copia arquivo por arquivo sem travar o servidor (progresso ao vivo, cancelável) e confere quantidade e tamanho de cada arquivo.
4. Grava o novo caminho em `configuracao-local.json` e reabre o banco no destino (ponto sem volta).
5. Só então apaga a origem. Se não conseguir apagar tudo (arquivo travado no Windows, por exemplo), a mudança continua valendo e o usuário recebe o aviso "Não foi possível apagar tudo em {origem}; apague à mão."

Falha ou cancelamento antes do passo 4: a origem continua válida e a cópia parcial no destino é removida.

### Apontar outra workspace

Em Configurações e no aviso de workspace ausente: "Apontar outro local" aceita somente uma pasta que seja workspace (tem `.gangoy-workspace.json` e `gangoy.db`). Serve para disco que mudou de letra e para abrir no Linux uma workspace criada no Windows.

### Workspace ausente

Se a pasta configurada não existir ou não tiver `.gangoy-workspace.json` (ex.: HD externo desligado), o sistema **não cria nada**. A API responde 503 `{ erro: "Workspace não encontrada em <caminho>" }` nas rotas que dependem dela; a interface mostra um aviso fixo com "Tentar de novo" e "Apontar outro local".

### Exclusão de projeto

Move a pasta do projeto para `<workspace>/.lixeira/<slug>-<data>/` e apaga o projeto do banco (capítulos e tarefas juntos). Mesmo disco, então é um `rename`.

### Limitação

SQLite não é confiável em pasta de rede (compartilhamento do Windows, NAS). A interface avisa isso ao escolher o local. HD externo e disco local funcionam.

## 6. Interface

### Estrutura fixa

- **Menu lateral:** Produção · Revisão · Dossiê · Projetos · Configurações. Rodapé com troca de tema ☾ Escuro / ☀ Claro.
- **Barra do topo:** SeletorProjeto, IndicadorFila ("Fila: 1 executando · 2 aguardando", clique abre a lista com cancelar e tentar de novo), status do Ollama e da workspace.
- **Temas:** variáveis CSS em `[data-tema="escuro"]` e `[data-tema="claro"]`; padrão escuro; escolha guardada em `localStorage`.
  - Escuro: fundo `#0f1218`, menu `#0b0d12`, cartões `#1b2030`, destaque `#3b82f6`.
  - Claro: menu `#141821`, fundo `#f3f4f7`, cartões brancos, destaque `#2563eb`.
- Desktop a partir de 1280 px, aceitável até 1024 px. Celular fora do escopo.

### Telas

1. **TelaBoasVindas:** escolha da workspace com NavegadorPastas; aviso sobre pasta de rede; aviso de que os projetos atuais serão trazidos.
2. **TelaProducao (quadro):** colunas por etapa; no subprojeto 1: **Planejado**, **Roteiro** (gerando ou aguardando aprovação) e **Roteiro aprovado**. As colunas vêm de uma tabela de mapeamento status → coluna, para os subprojetos 2 e 3 acrescentarem Mídia, Revisão do vídeo e Publicado sem mudar a tela. Regra: status `planejado` sem tarefa ativa → Planejado; `planejado` com tarefa `gerar_roteiro` na fila ou executando, ou `roteiro_gerado` → Roteiro; `aprovado` → Roteiro aprovado. Cartão: número, título, status, barra de progresso da tarefa ativa. Projeto sem capítulos: botão "Planejar história".
3. **TelaPlanejamento:** enredo → proposta (tarefa) → formulário editável: sinopse, mundo, personagens em cartões (nome, papel, aparência fixa, traços), lista de capítulos (título, resumo; adicionar, remover, reordenar) → confirmar.
4. **TelaCapitulo:**
   - cenas da versão escolhida (narração, personagens presentes, descrição visual);
   - duração estimada × alvo;
   - seletor de versões com instrução, modelo, tempo de geração e contexto ocupado de cada uma;
   - ações: Gerar, Refazer com instrução, Verificar continuidade (problemas em lista), cada uma com o campo "Gerar com" (SeletorModelo, padrão = modelo do projeto);
   - Aprovar roteiro → proposta de atualização do dossiê (tarefa) com caixas de seleção por item → confirmar.
5. **TelaRevisao:** pendências do usuário. No subprojeto 1: roteiros gerados não aprovados e propostas de dossiê prontas. Clique leva à tela do capítulo.
6. **TelaDossie:** editor por seções (Sinopse, Mundo, Personagens, Fatos, Fios abertos, Linha do tempo, Esboços, Resumos) com EditorLista; botão "Ver JSON" para edição direta (validada pelo esquema atual).
7. **TelaProjetos:** projetos em cartões (inicial colorida, temática, canal, duração, modelo); criar e editar em painel lateral; excluir com DialogoConfirmacao (explica a lixeira).
8. **TelaConfiguracoes:**
   - Workspace: caminho atual, espaço livre, "Mudar local", "Apontar outro local" e, se houver, "Apagar dados antigos já convertidos" (seção 5).
   - Modelos: modelo principal, modelo leve, contexto de trabalho (seção 8).
   - YouTube: formulário Client ID e Client Secret (segredo só de escrita); canais conectados com Conectar e Desconectar.
   - Ollama: endereço, versão, modelos instalados.

### Atualização ao vivo

`api/eventos.ts` mantém um `EventSource` em `/api/eventos`. As telas reagem a `tarefa` (cartões, indicador, avisos de conclusão ou falha) e a `sistema` (status do Ollama e da workspace).

## 7. Fila de tarefas

### Tipos no subprojeto 1

`propor_planejamento`, `gerar_roteiro`, `refazer_roteiro`, `verificar_continuidade`, `propor_atualizacao_dossie`, `mover_workspace`. Operações rápidas (listar, salvar dossiê, editar projeto, confirmar planejamento, aprovar) continuam síncronas.

### Regras

- Uma tarefa por vez, em ordem de criação (a GPU não comporta Ollama e ComfyUI juntos).
- Cada tipo é registrado como `tipo → executar(parametros, { relatarProgresso, sinal })`, que devolve o resultado (JSON). As funções atuais recebem `relatarProgresso(porcentagem, mensagem)` e `sinal: AbortSignal` como parâmetros opcionais; o `sinal` é repassado ao `fetch` do Ollama.
- `chave` = `tipo:projetoId:capitulo`. Criar tarefa com a mesma chave de outra `na_fila` ou `executando` → 409 "Já existe uma tarefa para isso".
- Cancelar: `na_fila` → `cancelada` na hora; `executando` → aborta o sinal e marca `cancelada`.
- Repetir: tarefa `falhou` ou `cancelada` gera uma tarefa nova com os mesmos parâmetros.
- Ao iniciar o servidor: tarefas `executando` viram `falhou` com erro "Interrompida: o servidor foi fechado durante a execução". As `na_fila` continuam.
- O resultado fica em `tarefas.resultado` (ex.: proposta de planejamento) até ser usado ou a tarefa ser removida da lista.
- Tarefas em status final (`concluida`, `falhou`, `cancelada`) há mais de 30 dias são apagadas do banco ao iniciar (só o registro; arquivos gerados ficam).

### Eventos (SSE)

`GET /api/eventos` envia `event: tarefa` com a tarefa completa sempre que ela muda, e `event: sistema` quando o status do Ollama ou da workspace muda (verificação a cada 15 s). Um comentário a cada 20 s mantém a conexão aberta. O navegador reconecta sozinho; ao reconectar, a interface recarrega a lista de tarefas.

## 8. Modelos do Ollama e contexto

### Seleção de modelos

- `GET /api/ollama/modelos` usa `/api/tags` (instalados) e `/api/show` de cada modelo (contexto máximo em `model_info["<arquitetura>.context_length"]`, capacidades). O resultado de `/api/show` fica em memória até a lista de modelos mudar.
- Níveis de escolha:
  1. **Sistema:** `modelo_principal` (planejamento, roteiro, refazer, continuidade) e `modelo_leve` (proposta de dossiê), na tabela `configuracoes`. `configuracao/app.json` passa a ser só o valor inicial.
  2. **Projeto:** `modelo_ollama` vazio = usar o principal do sistema; preenchido = sobrescreve.
  3. **Geração:** parâmetro opcional `modelo` em gerar, refazer e continuidade.
- Modelo configurado que não está mais instalado: aviso em Configurações e no projeto; a tarefa falha com "O modelo <nome> não está instalado no Ollama. Escolha outro em Configurações."
- Cada versão de roteiro passa a guardar `modelo`, `duracaoGeracaoSegundos` e `contexto` (`numCtx`, `tokensPrompt`, `tokensResposta`, `possivelCorte`).

### Proteção do contexto

Situação atual: o cliente não envia `num_ctx`, então o Ollama (0.35.1 nesta máquina) usa o padrão dele, que pode ser bem menor que o máximo do modelo (`gemma4:12b-it-qat`: 262.144; `gemma4:e4b-it-qat`: 131.072), e corta o começo do pedido sem avisar.

1. **Valor fixo enviado sempre:** `contexto_trabalho` (padrão 32.768, ajustável em Configurações, limitado ao máximo do modelo; escolhido para dar folga a obras longas, aceitando mais uso de VRAM. Se a medição com `npm run teste:ollama` mostrar o modelo principal parcialmente na CPU, o resultado é informado ao usuário antes da entrega; o padrão só muda com a aprovação dele) vai em `options.num_ctx` em toda chamada. Fixo para evitar que o Ollama recarregue o modelo a cada chamada com tamanho diferente.
2. **Reserva de resposta por tipo:** `options.num_predict` e a reserva usada na conta: roteiro 6.000, refazer 6.000, planejamento 4.000, continuidade 2.000, proposta de dossiê 2.000 tokens.
3. **Antes de enviar:** estimativa = `ceil(caracteres / fator)`, com `fator` inicial 3,0 caracteres por token (conservador para pt-BR). Se estimativa + reserva > `num_ctx`:
   - primeiro substitui o texto integral do capítulo anterior pelo resumo dele;
   - se ainda não couber, a tarefa falha: "O pedido precisa de ~N tokens e o contexto de trabalho é M. Aumente o contexto em Configurações ou escolha um modelo com contexto maior." O dossiê nunca é cortado.
4. **Depois da resposta:** grava `prompt_eval_count` e `eval_count`. Se `prompt_eval_count` ≥ `num_ctx` − reserva, marca `possivelCorte = true` e a interface mostra alerta na versão. O fator de estimativa é recalibrado pela média das últimas 20 chamadas (`caracteres / prompt_eval_count`), guardado em `configuracoes`.
5. **Uso visível:** tarefa e versão mostram "Contexto: 9,8 mil de 32 mil"; amarelo acima de 80%.
6. **GPU:** após cada chamada, consulta `/api/ps`; se `size_vram < size`, mostra em Configurações e na tarefa "Modelo X: N% na CPU (mais lento). Reduza o contexto ou use um modelo menor."

## 9. Banco de dados (`gangoy.db`)

Tabelas mantidas: `projetos`, `capitulos`, `contas_youtube`.

Mudanças:

- `projetos.modelo_ollama`: vazio passa a significar "usar o padrão do sistema". Na conversão, projetos com o valor igual ao `modeloPadrao` atual ficam vazios.
- Nova `configuracoes` (chave TEXT PK, valor TEXT, atualizado_em TEXT). Chaves: `modelo_principal`, `modelo_leve`, `contexto_trabalho`, `fator_tokens`, `youtube_client_id`, `youtube_client_secret`.
- Nova `tarefas`:

| Coluna | Observação |
|---|---|
| id | INTEGER PK |
| tipo | um dos tipos da seção 7 |
| chave | `tipo:projetoId:capitulo`, para evitar duplicadas |
| projeto_id | FK para projetos, ON DELETE CASCADE; nulo em `mover_workspace` |
| capitulo_numero | nulo quando não se aplica |
| parametros | JSON |
| status | `na_fila`, `executando`, `concluida`, `falhou`, `cancelada` |
| progresso, mensagem | 0 a 100 e texto curto |
| resultado, erro | JSON e texto |
| criada_em, iniciada_em, concluida_em | ISO 8601 |

A tabela `configuracoes_youtube` não existe mais (removida durante a mudança para `.env`; continha só credencial de teste).

## 10. API

Novas ou alteradas:

| Método | Rota | Função |
|---|---|---|
| GET | `/api/sistema/status` | workspace (configurada, disponível, caminho, espaço livre) e Ollama (online, versão) |
| GET | `/api/sistema/pastas?caminho=` | subpastas do caminho (sem ocultas) e raízes (Windows: unidades existentes; Linux: `/` e a pasta pessoal) |
| POST | `/api/sistema/pastas` | `{ caminhoPai, nome }` cria uma pasta |
| POST | `/api/workspace` | `{ local }` cria ou reconhece a workspace; executa a conversão quando for nova |
| POST | `/api/workspace/apontar` | `{ caminho }` aponta para uma workspace existente |
| POST | `/api/workspace/mover` | `{ destino }` → 202 `{ tarefaId }` |
| GET | `/api/workspace/dados-antigos` | lista `dados/app.db.migrado` e `dados/projetos.migrado` com tamanho (vazio se não houver) |
| DELETE | `/api/workspace/dados-antigos` | apaga esses dois itens; 404 se não existirem |
| GET / PUT | `/api/configuracoes` | modelos e contexto de trabalho |
| GET / PUT | `/api/configuracoes/youtube` | resumo (sem segredo) / salva credenciais; secret vazio mantém o atual |
| GET | `/api/ollama/modelos` | modelos instalados com contexto máximo e capacidades |
| GET | `/api/tarefas?projetoId=&status=` | lista |
| GET | `/api/tarefas/:id` | detalhe com resultado |
| POST | `/api/tarefas/:id/cancelar` | cancela |
| POST | `/api/tarefas/:id/repetir` | cria nova tarefa igual → 202 |
| GET | `/api/eventos` | SSE |
| GET | `/api/revisao?projetoId=` | pendências do usuário |
| POST | `/api/projetos/:id/planejamento` | agora → 202 `{ tarefaId }` |
| POST | `/api/projetos/:id/capitulos/:n/roteiro` | agora → 202; corpo opcional `{ modelo }` |
| POST | `/api/projetos/:id/capitulos/:n/refazer` | agora → 202; `{ instrucao, modelo? }` |
| POST | `/api/projetos/:id/capitulos/:n/continuidade` | agora → 202; `{ modelo? }` |
| POST | `/api/projetos/:id/capitulos/:n/proposta-dossie` | agora → 202 |

As demais rotas atuais continuam iguais. A UI trata 202 assinando o evento da tarefa e buscando `/api/tarefas/:id` ao concluir.

## 11. Credenciais

- Remover `src/nucleo/ambiente.ts`, `.env.exemplo` e a chamada `carregarAmbiente()`; remover do `.gitignore` as linhas de `.env`.
- `configuracoes/youtube.ts` volta a ler e gravar no banco (chaves `youtube_client_id` e `youtube_client_secret` da tabela `configuracoes`).
- O segredo nunca é devolvido pela API; o resumo informa só `clientSecretSalvo`.

## 12. Windows e Linux

- Caminhos sempre com `node:path` (`join`, `resolve`, `relative`); nenhum separador fixo. Na tela, o caminho aparece no formato do sistema.
- Slugs em minúsculas, sem acento; rejeita nomes reservados do Windows (`con`, `prn`, `aux`, `nul`, `com1`–`com9`, `lpt1`–`lpt9`) e nomes terminados em ponto ou espaço (acrescenta `-projeto` nesses casos).
- Conferência "dentro da workspace": `path.relative(workspace, alvo)` não pode começar com `..` nem ser absoluto.
- Scripts do `npm` sem comandos de shell; o que precisar de lógica vira script Node em `scripts/`.
- `.gitattributes`: `* text=auto eol=lf`.
- Workflow do GitHub Actions com matriz `windows-latest` e `ubuntu-latest`, Node 22: `npm ci`, `npm run verificar`, `npm test`, `npm run teste:interface`.

## 13. Erros e segurança

- Tratador de erro central (seção 4).
- **Mensagens de validação em pt-BR, próprias.** A tradução embutida do Zod (`z.locales.pt()`) é português de Portugal e genérica ("Demasiado grande: esperava que o número fosse <= 10"), por isso não é usada.
  - `src/nucleo/mensagensValidacao.ts` registra `z.config({ customError })` com uma mensagem em pt-BR para cada código de erro do Zod (`too_small`, `too_big`, `invalid_type` com campo ausente, `invalid_format`, `invalid_value`, `unrecognized_keys`, `invalid_union`, `custom` etc.). Código desconhecido → "Valor inválido".
  - O tratador de erro acrescenta o caminho do campo em português legível: `personagens.1.nome` → "Personagens › item 2 › nome: campo obrigatório". Os nomes de campo vêm de um mapa (`personagens` → "Personagens", `aparenciaFixa` → "Aparência fixa"...); campo fora do mapa aparece como está.
  - Formulários principais (projeto, configurações, credenciais) mantêm mensagens específicas na própria regra (ex.: "A duração mínima é 5 minutos"), que têm prioridade sobre o tradutor.
  - O mesmo arquivo é carregado pelo servidor e, se a interface validar formulários com Zod, por ela também.
- Ollama fora do ar: status vermelho; tarefa falha com "O Ollama não está respondendo em <url>".
- Servidor ouve só em `127.0.0.1`.
- Conferência do cabeçalho `Host`: aceita apenas `localhost:<porta>`, `127.0.0.1:<porta>` e, em desenvolvimento, a porta do Vite. Outros → 403. Protege contra DNS rebinding, já que a API lista pastas e move arquivos.
- Sem CORS.
- O navegador de pastas só lista; criar pasta exige ação explícita.
- Todo caminho montado com dados recebidos (slug, número de capítulo, nome de pasta nova) passa pela conferência de "dentro da workspace" ou valida que é um nome simples (sem separadores, sem `..`).

## 14. Testes

Desenvolvimento com TDD. Ferramentas: `node:test` com `tsx` para servidor; Playwright para a interface.

**Navegador dos testes de interface:** o Playwright usa o **Google Chrome instalado no sistema** (`channel: "chrome"` no `playwright.config.ts`), no Windows, no Linux e no GitHub Actions (`ubuntu-latest` e `windows-latest` já têm o Chrome). Nenhum navegador é baixado: não rodar `npx playwright install`. Se o Chrome não for encontrado, o teste falha com a mensagem do Playwright indicando a instalação do Chrome.

- **Unitários:** slug e nomes reservados; caminhos com `path.win32` e `path.posix`; conferência "dentro da workspace"; estimativa de tokens, reservas e troca do capítulo anterior pelo resumo; detecção de `possivelCorte`; fila (ordem, chave duplicada, cancelar na fila e em execução, repetir, "interrompida" após reinício); workspace (criar, reconhecer existente, ausente, mover no mesmo disco, mover com `EXDEV` simulado, falha no meio deixa a origem válida); conversão do formato atual (fixture com `versoes/`); apagar dados antigos remove só `app.db.migrado` e `projetos.migrado`; credenciais (segredo não sai na API); mensagens de validação (um caso por código de erro do Zod, conferindo que nenhuma sai em inglês nem com termos de pt-PT como "Demasiado" e "esperava que", e o caminho do campo em português).
- **API:** `criarApp()` com workspace em pasta temporária e **Ollama falso** (servidor HTTP local com `/api/tags`, `/api/show`, `/api/chat`, `/api/ps` e respostas prontas): fluxo planejar → confirmar → gerar → refazer → continuidade → propor → aprovar via fila; 202 + eventos; Host inválido → 403.
- **Interface (Playwright):** criar workspace em pasta temporária; criar projeto; planejar com Ollama falso e confirmar pelo formulário; cartão aparece em Planejado e vai para Roteiro com barra de progresso; tema escolhido continua após recarregar; aprovar roteiro com seleção de itens do dossiê.
- **Manual com Ollama real:** `npm run teste:ollama` faz uma chamada curta com o modelo principal e `num_ctx` configurado, mostra `prompt_eval_count`, tempo e a fração em GPU de `/api/ps`.

## 15. Fora do escopo

Subprojetos 2 a 4; tela de revisão de vídeo; uso em celular; login ou múltiplos usuários; Pinia; Tailwind; workspace em pasta de rede; apagar `dados/lixeira/` (fica a critério do usuário).

## 16. Documentação

Ao fim do subprojeto: criar um `README.md` curto na raiz (o que é, requisitos, `npm install`, `npm run dev`, `npm run iniciar`, `npm test`) e atualizar a tabela de subprojetos em [2026-10-06-gangoy-videos-visao-geral-design.md](2026-10-06-gangoy-videos-visao-geral-design.md) marcando o subprojeto 1 como concluído. Os documentos antigos `docs/plano.md`, `docs/progresso.md` e `docs/tdd-implementacao.md` foram removidos (estão no histórico do Git).
