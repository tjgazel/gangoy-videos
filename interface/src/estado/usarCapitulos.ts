import { onUnmounted, ref, watch } from "vue";
import { chamarApi } from "../api/cliente";
import { aoEvento } from "../api/eventos";
import type { Capitulo } from "../api/tipos";
import { usarProjetoAtual } from "./usarProjetoAtual";

// Capítulos do projeto atual, recarregados quando uma tarefa do projeto termina.
export function usarCapitulos() {
  const { projetoAtualId } = usarProjetoAtual();
  const capitulos = ref<Capitulo[]>([]);
  const carregado = ref(false);

  async function recarregar() {
    if (!projetoAtualId.value) {
      capitulos.value = [];
      carregado.value = true;
      return;
    }
    capitulos.value = await chamarApi<Capitulo[]>(`/api/projetos/${projetoAtualId.value}/capitulos`).catch(() => []);
    carregado.value = true;
  }

  const cancelar = aoEvento("tarefa", (tarefa) => {
    if (tarefa.projetoId === projetoAtualId.value && ["concluida", "falhou", "cancelada"].includes(tarefa.status)) {
      void recarregar();
    }
  });
  onUnmounted(cancelar);
  watch(projetoAtualId, recarregar, { immediate: true });

  return { capitulos, carregado, recarregar };
}
