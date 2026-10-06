import { computed, ref } from "vue";
import { chamarApi } from "../api/cliente";
import { aoEvento, aoReconectar } from "../api/eventos";
import type { Tarefa } from "../api/tipos";
import { avisar } from "./usarAvisos";

const FINAIS = ["concluida", "falhou", "cancelada"];
const tarefas = ref<Tarefa[]>([]);
const esperando = new Map<number, ((tarefa: Tarefa) => void)[]>();
let iniciado = false;

export function nomeDaTarefa(tarefa: Tarefa): string {
  const capitulo = tarefa.capituloNumero ? ` do capítulo ${tarefa.capituloNumero}` : "";
  switch (tarefa.tipo) {
    case "propor_planejamento":
      return "Planejamento da história";
    case "gerar_roteiro":
      return `Roteiro${capitulo}`;
    case "refazer_roteiro":
      return `Nova versão do roteiro${capitulo}`;
    case "verificar_continuidade":
      return `Continuidade${capitulo}`;
    case "propor_atualizacao_dossie":
      return `Proposta para o dossiê${capitulo}`;
    case "mover_workspace":
      return "Mudança da workspace";
  }
}

// O status de uma tarefa só avança. Uma resposta atrasada da API (ou uma lista recarregada) pode trazer um
// retrato anterior à conclusão que o evento ao vivo já avisou; esse retrato não pode reverter a tarefa.
function regride(local: Tarefa | undefined, nova: Tarefa): boolean {
  return Boolean(local && FINAIS.includes(local.status) && !FINAIS.includes(nova.status));
}

function aplicar(nova: Tarefa): void {
  const anterior = tarefas.value.find((tarefa) => tarefa.id === nova.id);
  if (regride(anterior, nova)) return;
  // Guarda o status de antes: o Object.assign abaixo sobrescreve o objeto.
  const statusAnterior = anterior?.status;
  if (anterior) Object.assign(anterior, nova);
  else tarefas.value = [nova, ...tarefas.value].slice(0, 100);

  const terminou = FINAIS.includes(nova.status) && (!statusAnterior || !FINAIS.includes(statusAnterior));
  if (!terminou) return;
  if (nova.status === "concluida") avisar(`Tarefa concluída: ${nomeDaTarefa(nova)}`);
  if (nova.status === "falhou") avisar(`Tarefa falhou: ${nomeDaTarefa(nova)}. ${nova.erro ?? ""}`, "erro");
  esperando.get(nova.id)?.forEach((resolver) => resolver(nova));
  esperando.delete(nova.id);
}

async function recarregar(): Promise<void> {
  try {
    const recebida = await chamarApi<Tarefa[]>("/api/tarefas");
    const locais = new Map(tarefas.value.map((tarefa) => [tarefa.id, tarefa]));
    const lista = recebida.map((tarefa) => (regride(locais.get(tarefa.id), tarefa) ? (locais.get(tarefa.id) as Tarefa) : tarefa));
    tarefas.value = lista;
    for (const tarefa of lista) {
      if (FINAIS.includes(tarefa.status)) {
        esperando.get(tarefa.id)?.forEach((resolver) => resolver(tarefa));
        esperando.delete(tarefa.id);
      }
    }
  } catch {
    tarefas.value = []; // sem workspace: não há fila
  }
}

export function usarTarefas() {
  if (!iniciado) {
    iniciado = true;
    aoEvento("tarefa", aplicar);
    aoReconectar(() => void recarregar());
    void recarregar();
  }
  return {
    tarefas,
    executando: computed(() => tarefas.value.filter((tarefa) => tarefa.status === "executando").length),
    aguardando: computed(() => tarefas.value.filter((tarefa) => tarefa.status === "na_fila").length),
    recarregar,
    ativaDoCapitulo(projetoId: number, numero: number): Tarefa | null {
      return (
        tarefas.value.find(
          (tarefa) =>
            tarefa.projetoId === projetoId &&
            tarefa.capituloNumero === numero &&
            (tarefa.status === "na_fila" || tarefa.status === "executando"),
        ) ?? null
      );
    },
    // Resolve quando a tarefa termina (concluída, com falha ou cancelada).
    aguardar(id: number): Promise<Tarefa> {
      const conhecida = tarefas.value.find((tarefa) => tarefa.id === id);
      if (conhecida && FINAIS.includes(conhecida.status)) return Promise.resolve(conhecida);
      return new Promise((pronto) => {
        esperando.set(id, [...(esperando.get(id) ?? []), pronto]);
        void chamarApi<Tarefa>(`/api/tarefas/${id}`).then((tarefa) => aplicar(tarefa)).catch(() => {});
      });
    },
  };
}
