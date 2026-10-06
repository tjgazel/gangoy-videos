import { ref } from "vue";
import { chamarApi } from "../api/cliente";
import { aoEvento } from "../api/eventos";
import type { StatusSistema } from "../api/tipos";

const status = ref<StatusSistema | null>(null);
let carregando: Promise<StatusSistema> | null = null;
let assinado = false;

async function recarregar(): Promise<StatusSistema> {
  status.value = await chamarApi<StatusSistema>("/api/sistema/status");
  return status.value;
}

export function usarStatusSistema() {
  if (!assinado) {
    assinado = true;
    aoEvento("sistema", (dados) => (status.value = dados));
  }
  return {
    status,
    recarregar,
    // Primeira carga compartilhada (guarda de rotas e barra do topo pedem ao mesmo tempo).
    garantirCarregado(): Promise<StatusSistema> {
      if (status.value) return Promise.resolve(status.value);
      carregando ??= recarregar().finally(() => (carregando = null));
      return carregando;
    },
  };
}
