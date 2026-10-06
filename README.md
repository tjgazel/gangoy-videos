# Gangoy Vídeos

Sistema local que transforma histórias em vídeos de desenho animado em português do Brasil e publica no YouTube. Roda no seu computador (Windows ou Linux), com o Ollama gerando planejamento, roteiros e revisão de continuidade.

Hoje o sistema planeja a história, gera e refaz roteiros por capítulo, confere a continuidade contra o dossiê e mantém o dossiê atualizado. Narração, imagens, montagem do vídeo e publicação vêm nos próximos subprojetos (veja as specs).

## Requisitos

- Node.js 22.12 ou mais novo
- [Ollama](https://ollama.com) instalado e em execução, com pelo menos um modelo (padrão: `gemma4:12b-it-qat` e `gemma4:e4b-it-qat`)
- Google Chrome, só para os testes de interface

## Uso

```bash
npm install
npm run iniciar
```

Abra `http://localhost:3000`. Na primeira vez, escolha onde criar a pasta `Gangoy-workspace`: nela ficam o banco, os roteiros e a mídia de todos os projetos. Para backup ou para levar a outro computador, basta copiar essa pasta.

## Desenvolvimento

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor (porta 3000) e interface com recarga automática (`http://localhost:5173`) |
| `npm run verificar` | Checagem de tipos do servidor e da interface |
| `npm test` | Testes do servidor e da API (sem Ollama real) |
| `npm run teste:interface` | Testes da interface no Chrome instalado |
| `npm run teste:ollama` | Chamada curta ao Ollama real: tokens, tempo e quanto do modelo ficou na GPU |

## Documentação

- [Visão geral](docs/superpowers/specs/2026-10-06-gangoy-videos-visao-geral-design.md): produto, glossário e requisitos de todos os subprojetos
- [Subprojeto 1: base do sistema](docs/superpowers/specs/2026-10-06-gangoy-videos-design.md)
- [Plano de implementação do subprojeto 1](docs/superpowers/plans/2026-10-06-gangoy-videos.md)
