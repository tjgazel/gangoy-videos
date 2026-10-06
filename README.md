# Gangoy Vídeos

[![Testes](https://github.com/tjgazel/gangoy-videos/actions/workflows/testes.yml/badge.svg)](https://github.com/tjgazel/gangoy-videos/actions/workflows/testes.yml)
[![Licença: AGPL-3.0-or-later](https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0--or--later-blue.svg)](LICENSE)

Sistema local que transforma histórias em vídeos de desenho animado em português do Brasil e publica no YouTube. Roda no seu computador (Windows ou Linux), com o Ollama gerando planejamento, roteiros e revisão de continuidade.

Hoje o sistema planeja a história, gera e refaz roteiros por capítulo, confere a continuidade contra o dossiê e mantém o dossiê atualizado. Narração, imagens, montagem do vídeo e publicação vêm nos próximos subprojetos (veja [a tabela de subprojetos](docs/superpowers/specs/2026-10-06-gangoy-videos-visao-geral-design.md#3-subprojetos)).

Tudo fica na sua máquina: o servidor só aceita conexões do próprio computador (`127.0.0.1`), e os modelos rodam no seu Ollama. A internet só é usada quando você conecta um canal do YouTube.

## Requisitos

- Node.js 22.13 ou mais novo (o banco usa o `node:sqlite`, que só funciona sem opção extra a partir dessa versão)
- [Ollama](https://ollama.com) instalado e em execução, com pelo menos um modelo (padrão: `gemma4:12b-it-qat` e `gemma4:e4b-it-qat`)
- Placa de vídeo com memória suficiente para o modelo escolhido (desenvolvido numa RTX 4070 Ti de 12 GB). Sem GPU funciona, mas fica bem mais lento.
- Google Chrome, só para os testes de interface

Para baixar os modelos padrão:

```bash
ollama pull gemma4:12b-it-qat
ollama pull gemma4:e4b-it-qat
```

## Uso

```bash
git clone https://github.com/tjgazel/gangoy-videos.git
cd gangoy-videos
npm install
npm run iniciar
```

Abra `http://localhost:3000`. Na primeira vez, escolha onde criar a pasta `Gangoy-workspace`: nela ficam o banco, os roteiros e a mídia de todos os projetos. Para backup ou para levar a outro computador, basta copiar essa pasta.

Para atualizar: `git pull`, `npm install` e `npm run iniciar` de novo.

## Configuração

- **Na interface (Configurações):** modelos principal e leve, contexto de trabalho do Ollama, credenciais do YouTube e lugar da workspace.
- **Em `configuracao/app.json`:** porta do servidor (`porta`), endereço do Ollama (`ollama.url`) e modelos padrão. Reinicie o servidor depois de mudar.
- **Em `dados/configuracao-local.json`:** só o caminho da workspace desta máquina. É criado pelo sistema e fica fora do Git.

Para saber se o modelo cabe na placa de vídeo com o contexto configurado, rode `npm run teste:ollama`: ele mostra quanto do modelo ficou na GPU.

## Desenvolvimento

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor (porta 3000) e interface com recarga automática (`http://localhost:5173`) |
| `npm run verificar` | Checagem de tipos do servidor e da interface |
| `npm test` | Testes do servidor e da API (sem Ollama real) |
| `npm run teste:interface` | Testes da interface no Chrome instalado |
| `npm run teste:ollama` | Chamada curta ao Ollama real: tokens, tempo e quanto do modelo ficou na GPU |

O código fica em `src/` (servidor, Fastify) e `interface/` (Vue 3 + Vite); os testes, em `testes/`. Nomes de variáveis, funções e arquivos são em português, sem acento.

## Documentação

- [Visão geral](docs/superpowers/specs/2026-10-06-gangoy-videos-visao-geral-design.md): produto, glossário e requisitos de todos os subprojetos
- [Subprojeto 1: base do sistema](docs/superpowers/specs/2026-10-06-gangoy-videos-design.md)
- [Plano de implementação do subprojeto 1](docs/superpowers/plans/2026-10-06-gangoy-videos.md)

## Licença

[GNU Affero General Public License v3.0 ou posterior](LICENSE) (AGPL-3.0-or-later).

Você pode usar, estudar, modificar e redistribuir o Gangoy Vídeos, inclusive para fins comerciais. Quem distribuir uma versão modificada, ou oferecê-la a outras pessoas pela rede, precisa disponibilizar o código-fonte dela sob a mesma licença. Contribuições enviadas a este repositório entram sob a mesma licença.
