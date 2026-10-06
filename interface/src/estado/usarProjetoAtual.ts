import { computed, ref, watch } from "vue";
import { chamarApi } from "../api/cliente";
import type { Projeto } from "../api/tipos";

const CHAVE = "gangoy.projetoAtual";
const projetos = ref<Projeto[]>([]);
const guardado = Number(localStorage.getItem(CHAVE));
const projetoAtualId = ref<number | null>(Number.isFinite(guardado) && guardado > 0 ? guardado : null);

watch(projetoAtualId, (id) => {
  if (id) localStorage.setItem(CHAVE, String(id));
  else localStorage.removeItem(CHAVE);
});

async function recarregar(): Promise<void> {
  projetos.value = await chamarApi<Projeto[]>("/api/projetos");
  // Mantém o projeto escolhido se ele ainda existir; senão, o primeiro da lista.
  if (!projetos.value.some((projeto) => projeto.id === projetoAtualId.value)) {
    projetoAtualId.value = projetos.value[0]?.id ?? null;
  }
}

export function usarProjetoAtual() {
  return {
    projetos,
    projetoAtualId,
    projetoAtual: computed(() => projetos.value.find((projeto) => projeto.id === projetoAtualId.value) ?? null),
    recarregar,
  };
}
