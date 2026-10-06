// Verificação manual com o Ollama real: modelo principal e contexto configurados,
// tokens lidos de verdade e quanto do modelo ficou na GPU.
import { z } from "zod";
import { abrirWorkspaceConfigurada } from "../src/workspace/workspace.js";
import { obterConfiguracoesSistema } from "../src/configuracoes/sistema.js";
import { garantirModeloInstalado } from "../src/ollama/modelos.js";
import { gerarJsonIa } from "../src/ollama/ollama.js";
import { obterOpcoesExecucao } from "../src/nucleo/opcoesExecucao.js";

abrirWorkspaceConfigurada();
const { modeloPrincipal, contextoTrabalho } = obterConfiguracoesSistema();
console.log(`Ollama: ${obterOpcoesExecucao().urlOllama}`);
console.log(`Modelo principal: ${modeloPrincipal} · contexto de trabalho: ${contextoTrabalho.toLocaleString("pt-BR")}`);

const modelo = await garantirModeloInstalado(modeloPrincipal);
const { dados, medicao } = await gerarJsonIa(
  modelo,
  [
    { role: "system", content: "Você planeja histórias infantis em português do Brasil. Responda só com o JSON pedido." },
    { role: "user", content: "Resuma em uma frase uma história sobre um menino e um dragão que salvam a vila da seca." },
  ],
  z.object({ resumo: z.string().min(10) }),
  { tipo: "planejamento" },
);

console.log(`Resposta: ${dados.resumo}`);
console.log(`num_ctx: ${medicao.numCtx} · prompt_eval_count: ${medicao.tokensPrompt} · resposta: ${medicao.tokensResposta} tokens`);
console.log(`Tempo: ${medicao.duracaoSegundos} s`);
console.log(
  medicao.percentualCpu === null
    ? "GPU: não foi possível medir (/api/ps)"
    : medicao.percentualCpu === 0
      ? "GPU: 100% na GPU"
      : `GPU: ${medicao.percentualCpu}% na CPU (mais lento)`,
);
