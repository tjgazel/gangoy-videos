# Spec: Visão geral do Gangoy Vídeos

Data: 2026-10-06 · Status: referência para todos os subprojetos

Documento de produto: o que o sistema faz, os termos usados e os requisitos que valem para todos os subprojetos. Cada subprojeto tem a sua spec detalhada nesta pasta; o primeiro é [2026-10-06-gangoy-videos-design.md](2026-10-06-gangoy-videos-design.md). Substitui o antigo `docs/plano.md` (disponível no histórico do Git).

## 1. Produto

**Gangoy Vídeos** (nome na interface; pacote e pastas técnicas `gangoy-videos`) é um sistema **local**, para o PC do usuário (RTX 4070 Ti 12 GB, Windows ou Linux), que transforma histórias em vídeos de desenho animado em português do Brasil e publica no YouTube.

Requisitos do produto:

- **Projetos por temática**, cada um com canal, playlist padrão, frequência de produção, duração-alvo por vídeo e dossiê da história.
- **Continuidade** entre capítulos: personagens, fatos, linha do tempo e fios abertos não se perdem; o modelo não inventa sem controle.
- **Imagens em estilo cartoon moderno (charge)**, sincronizadas com a narração.
- **Legenda pt-BR** em SRT, para o YouTube traduzir automaticamente.
- **Áudio no padrão da dublagem automática** do YouTube (voz limpa, em faixa separada).
- **Refazer** roteiro e cenas com instruções do usuário quando o modelo errar.
- **Importar uma obra completa** (arquivo ou URL, ex.: Bíblia Sagrada) e dividir em capítulos de no máximo 10 min, com uma playlist por livro.
- Gerar, revisar, aprovar e **publicar** pelo sistema no canal do projeto.

## 2. Glossário

- **Dossiê**: arquivo `dossie.json` de cada projeto com tudo o que já foi decidido sobre a história: sinopse, mundo, personagens (com `aparenciaFixa`), fatos, fios abertos, linha do tempo, esboços e resumos dos capítulos. É enviado ao modelo a cada capítulo para a história não se contradizer. (O nome antigo "bíblia da história" foi abandonado para não confundir com a Bíblia Sagrada.)
- **Aparência fixa**: descrição visual de um personagem que entra em todo pedido de imagem, para ele não mudar de cara entre cenas e capítulos.
- **Workspace**: pasta `Gangoy-workspace`, escolhida pelo usuário, com o banco e todos os projetos (detalhes na spec do subprojeto 1).
- **Tarefa**: trabalho longo (gerar roteiro, imagens, áudio, render) executado em segundo plano, um por vez.

## 3. Subprojetos

| # | Subprojeto | Conteúdo | Spec |
|---|---|---|---|
| 1 | Base do sistema (concluído) | Workspace, painel Vue, fila de tarefas, modelos e contexto, credenciais, Windows/Linux, testes | [gangoy-videos](2026-10-06-gangoy-videos-design.md) |
| 2 | Ferramentas e mídia | `npm run preparar`, Piper, legenda, ComfyUI, render FFmpeg | a escrever |
| 3 | Revisão do vídeo | Player com roteiro sincronizado, marcação por cena, refazer só as marcadas, aprovação | a escrever |
| 4 | Publicação e automação | Upload, legenda e playlist no YouTube, importação de obra completa, agenda | a escrever |

Já implementado antes do replanejamento (base para o subprojeto 1): projetos (criar, editar, excluir), dossiê, planejamento a partir de enredo, roteiro com controle de tamanho, continuidade, refazer com instrução, atualização do dossiê após aprovação e OAuth do YouTube por canal.

## 4. Decisões gerais

| Tema | Decisão |
|---|---|
| Linguagem | Node.js 22 + TypeScript |
| Nomes no código | Variáveis, funções, arquivos e pastas em português sem acento nem caractere especial (`criarProjeto`, `pasta_capitulos`). Só a sintaxe da linguagem fica em inglês. |
| Interface | Vue 3 + Vite + TypeScript; painel com quadro de produção; tema escuro (padrão) e claro |
| Dados | SQLite (`node:sqlite`) e arquivos por projeto, dentro da workspace |
| LLM | Ollama, instalado pelo usuário. Modelo principal padrão `gemma4:12b-it-qat` (planejamento, roteiro, refazer, continuidade); modelo leve padrão `gemma4:e4b-it-qat` (resumos, extração de fatos). Escolha entre os modelos instalados, por sistema, projeto ou geração. |
| Imagens | ComfyUI + SDXL, LoRA cartoon e IP-Adapter |
| Narração | Piper TTS, voz pt-BR (`pt_BR-faber-medium` ou `pt_BR-cadu-medium`) |
| Vídeo | FFmpeg |
| Ferramentas | FFmpeg, Piper e ComfyUI dentro de `ferramentas/`, nos dois sistemas, baixados por `npm run preparar` com confirmação; usa a do sistema se já existir |
| Downloads | Arquivos grandes só com confirmação do usuário, informando nome, origem e tamanho |
| Legenda | SRT pt-BR como faixa original, sem legenda queimada no vídeo |
| YouTube | YouTube Data API v3 com OAuth da conta do usuário, uma conexão por canal |
| Segredos | Client ID, Client Secret e tokens no banco local (dentro da workspace, fora do Git); nunca devolvidos pela API |

## 5. Fluxo de um capítulo

1. **Contexto**: dossiê completo + resumos anteriores + texto integral do último capítulo (respeitando o contexto de trabalho do Ollama).
2. **Roteiro** (Ollama): JSON com `cenas[]` (`narracao`, `personagens_presentes`, `descricao_visual`), validado com Zod; em erro, reenvia com a mensagem.
3. **Continuidade**: segunda chamada compara roteiro × dossiê e lista contradições.
4. **Aprovação do roteiro**: o usuário lê, pode refazer com instruções (cada versão é salva, nenhuma é sobrescrita) e aprova.
5. **Atualização do dossiê**: após aprovar, o sistema propõe fatos e personagens novos; o usuário confirma o que vira oficial.
6. **Imagens**: prompt = estilo do projeto + cena + `aparenciaFixa` de cada personagem + referência IP-Adapter. Cada imagem guarda o hash da cena; ao refazer, só as cenas alteradas são regeneradas.
7. **Áudio**: Piper gera a fala de cada cena; duração medida com `ffprobe`.
8. **Sincronia**: duração da cena = duração do áudio + folga curta; troca de imagem e legenda acompanham a fala.
9. **Legenda**: `legenda.srt` pt-BR com os tempos reais, até ~42 caracteres por linha.
10. **Render**: 1920x1080, H.264, zoom e pan leves, transições suaves.
11. **Alerta de duração**: vídeo acima do limite configurado (padrão 15 min, limite de contas sem verificação; contas verificadas chegam a 12 h) gera aviso antes do envio.
12. **Aprovação do vídeo**: o usuário assiste com o roteiro sincronizado, marca cenas com problema (imagem, narração ou texto) e refaz só essas, ou aprova.
13. **Publicação**: botão "Publicar" envia ao canal do projeto (privacidade escolhida na hora: privado, não listado ou público), envia a legenda e adiciona à playlist.

Status do capítulo ao longo do fluxo: `planejado` → `roteiro_gerado` → `aprovado` (roteiro) → mídia → vídeo em revisão → vídeo aprovado → `publicado`. Os nomes exatos dos estados depois de `aprovado` são definidos nas specs dos subprojetos 2 e 3.

## 6. Requisitos por área (para as próximas specs)

### Roteiro e continuidade (já implementado, manter)

- Duração-alvo por capítulo herda do projeto (5 a 10 min, padrão 8) e pode mudar por capítulo; texto calculado com **~150 palavras por minuto**.
- Se o roteiro ficar abaixo de **80% do alvo**, o sistema pede uma ampliação, uma vez.
- Chamadas com **`think: false`**: o modelo não gasta tokens com raciocínio oculto.
- Limitação conhecida: o revisor de continuidade vê o dossiê e o capítulo atual; um fato que existe só no texto de um capítulo anterior, e não foi para o dossiê, pode passar despercebido.

### Áudio para dublagem automática (subprojeto 2)

- Narração gravada separada: voz limpa, sem música no mesmo arquivo; exportada também como `narracao.wav`.
- Mixagem final com música e efeitos opcionais em faixa separada, voz em destaque (ducking).
- 48 kHz, AAC 192 kbps, normalizado em **-14 LUFS** (`loudnorm`), idioma marcado como `pt`.
- A disponibilidade da dublagem automática depende da elegibilidade do canal no YouTube; o sistema entrega o áudio no formato certo, mas não garante que a função esteja liberada.

### Imagens e consistência (subprojeto 2)

- Cada projeto tem um **perfil de estilo**: modelo SDXL, LoRA, paleta de cores e prompt negativo.
- `aparenciaFixa` de cada personagem em todo prompt, com a mesma referência IP-Adapter, a mesma LoRA e seed por personagem.
- Character sheet por personagem em `personagens/<slug>/referencia.png`.
- Limitação: a consistência com SDXL é boa, não perfeita; pode haver pequenas variações de rosto.
- **VRAM**: Ollama e ComfyUI não rodam juntos. Antes de chamar o ComfyUI, descarregar o modelo do Ollama (`keep_alive: 0`), e o inverso. A fila de tarefas única do subprojeto 1 já evita execução simultânea.

### YouTube (subprojeto 4)

- Quota padrão: 10.000 unidades/dia. `videos.insert` custa ~1.600; `playlistItems.insert` ~50. Cabem em torno de 5 a 6 uploads por dia.
- **Projeto do Google Cloud não verificado só permite upload privado.** Para público ou não listado, o projeto precisa passar pela auditoria do Google; até lá, o sistema envia como privado e avisa na tela.
- Preparação no Google Cloud (passo a passo na interface): projeto, YouTube Data API v3 ativada, credencial OAuth "App para computador", tela de consentimento com a conta do usuário como usuário de teste.

### Importação de obra completa (subprojeto 4)

- Fontes: `.docx` (lido com `mammoth`), `.txt`, `.epub`, `.pdf` ou URL. Arquivos `.doc` antigos: salvar como `.docx` no Word.
- Cada **livro** vira uma **playlist**; o texto é dividido em capítulos de no máximo **10 min** de narração (~1.300 a 1.400 palavras, ajustado pelo ritmo do Piper).
- Ordem fixa e rastreável: cada capítulo guarda o trecho-fonte (livro, capítulo, versículos).
- A quantidade de capítulos vem da divisão do texto, não de estimativa; o dossiê é preenchido a partir do texto e cresce capítulo a capítulo.
- O roteiro adapta o trecho-fonte com fidelidade; o usuário revisa antes de publicar.
- Direitos: usar textos de domínio público ou com direito de uso; o sistema registra a fonte de cada projeto.
- Escala: uma obra grande gera centenas de capítulos; o gargalo são as imagens. A fila roda em lote e pode ser pausada.

### Agenda (subprojeto 4)

- A frequência do projeto (`diaria` ou `semanal:<dia>:HH:MM`) é **cronograma de produção**: o sistema prepara o próximo capítulo com antecedência e o coloca na fila de revisão.
- A publicação só acontece quando o usuário aperta "Publicar".

## 7. Verificação de ponta a ponta (ao fim do subprojeto 4)

- Três capítulos seguidos sem contradição de nomes, fatos e fios abertos em relação ao dossiê.
- Refazer uma cena com instrução altera só as cenas afetadas.
- `ffprobe` no vídeo e no áudio: sincronia; legenda aparece junto da fala.
- Áudio a -14 LUFS, 48 kHz, faixa de voz separada.
- Vídeo de teste privado no YouTube com legenda pt-BR visível, na playlist correta; alerta de duração disparado com vídeo longo.
- Importação de um `.docx` dividida em capítulos de até 10 min.
