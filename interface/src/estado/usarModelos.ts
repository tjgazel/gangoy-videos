import { ref } from "vue";
import { chamarApi } from "../api/cliente";
import type { ConfiguracoesSistema, ModeloOllama } from "../api/tipos";

const modelos = ref<ModeloOllama[]>([]);
const configuracoes = ref<ConfiguracoesSistema | null>(null);
const erro = ref("");

// O Ollama trata "qwen3.6" como "qwen3.6:latest".
export function normalizarNomeModelo(nome: string): string {
  const limpo = nome.trim();
  return limpo.includes(":") ? limpo : `${limpo}:latest`;
}

async function recarregar(): Promise<void> {
  erro.value = "";
  const [lista, sistema] = await Promise.allSettled([
    chamarApi<ModeloOllama[]>("/api/ollama/modelos"),
    chamarApi<ConfiguracoesSistema>("/api/configuracoes"),
  ]);
  if (lista.status === "fulfilled") modelos.value = lista.value;
  else erro.value = lista.reason instanceof Error ? lista.reason.message : "Não foi possível listar os modelos";
  if (sistema.status === "fulfilled") configuracoes.value = sistema.value;
}

export function usarModelos() {
  return {
    modelos,
    configuracoes,
    erro,
    recarregar,
    instalado(nome: string): boolean {
      return modelos.value.some((modelo) => normalizarNomeModelo(modelo.nome) === normalizarNomeModelo(nome));
    },
  };
}
