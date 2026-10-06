import { registrarExecutor } from "./fila.js";
import { proporPlanejamento } from "../planejamento/planejamento.js";
import { gerarRoteiroCapitulo, refazerRoteiroCapitulo } from "../roteiro/roteiro.js";
import { verificarContinuidade } from "../continuidade/continuidade.js";
import { proporAtualizacaoDossie } from "../dossie/atualizacao.js";

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

// Trabalhos da história que rodam pela fila (todos chamam o Ollama).
export function registrarExecutoresHistoria(): void {
  registrarExecutor("propor_planejamento", (tarefa, contexto) =>
    proporPlanejamento(tarefa.projetoId!, String(tarefa.parametros.enredo ?? ""), {
      modelo: texto(tarefa.parametros.modelo),
      contexto,
    }),
  );

  registrarExecutor("gerar_roteiro", async (tarefa, contexto) => {
    const versao = await gerarRoteiroCapitulo(tarefa.projetoId!, tarefa.capituloNumero!, {
      modelo: texto(tarefa.parametros.modelo),
      contexto,
    });
    return { versao: versao.versao };
  });

  registrarExecutor("refazer_roteiro", async (tarefa, contexto) => {
    const versao = await refazerRoteiroCapitulo(
      tarefa.projetoId!,
      tarefa.capituloNumero!,
      String(tarefa.parametros.instrucao ?? ""),
      { modelo: texto(tarefa.parametros.modelo), contexto },
    );
    return { versao: versao.versao };
  });

  registrarExecutor("verificar_continuidade", (tarefa, contexto) =>
    verificarContinuidade(tarefa.projetoId!, tarefa.capituloNumero!, {
      modelo: texto(tarefa.parametros.modelo),
      contexto,
    }),
  );

  registrarExecutor("propor_atualizacao_dossie", (tarefa, contexto) =>
    proporAtualizacaoDossie(tarefa.projetoId!, tarefa.capituloNumero!, { contexto }),
  );
}
