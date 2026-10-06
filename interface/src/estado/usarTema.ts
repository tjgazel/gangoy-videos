import { ref, watch } from "vue";

export type Tema = "escuro" | "claro";
const CHAVE = "gangoy.tema";

// Um só estado para o app inteiro; a escolha fica salva no navegador.
const tema = ref<Tema>(localStorage.getItem(CHAVE) === "claro" ? "claro" : "escuro");

watch(
  tema,
  (valor) => {
    document.documentElement.dataset.tema = valor;
    localStorage.setItem(CHAVE, valor);
  },
  { immediate: true },
);

export function usarTema() {
  return {
    tema,
    definir(valor: Tema) {
      tema.value = valor;
    },
    alternar() {
      tema.value = tema.value === "escuro" ? "claro" : "escuro";
    },
  };
}
