<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { chamarApi } from "../api/cliente";
import { aoEvento } from "../api/eventos";
import type { ItemRevisao } from "../api/tipos";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";

const { projetoAtual } = usarProjetoAtual();
const itens = ref<ItemRevisao[]>([]);
const carregado = ref(false);

const DESCRICAO: Record<ItemRevisao["tipo"], string> = {
  roteiro_para_aprovar: "Roteiro para aprovar",
  proposta_dossie_pronta: "Proposta do dossiê pronta",
};

async function carregar() {
  if (!projetoAtual.value) return;
  itens.value = (await chamarApi<{ itens: ItemRevisao[] }>(`/api/revisao?projetoId=${projetoAtual.value.id}`)).itens;
  carregado.value = true;
}

function desde(data: string): string {
  return data ? new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
}

const cancelar = aoEvento("tarefa", (tarefa) => {
  if (tarefa.status === "concluida" && tarefa.projetoId === projetoAtual.value?.id) void carregar();
});
onUnmounted(cancelar);
watch(() => projetoAtual.value?.id, carregar, { immediate: true });
</script>

<template>
  <section class="tela">
    <header class="tela-cabecalho"><h1>Revisão</h1></header>
    <p v-if="!projetoAtual" class="vazio">Escolha um projeto no topo da tela.</p>
    <p v-else-if="carregado && !itens.length" class="vazio">Nada esperando por você. Gere roteiros na tela Produção.</p>
    <ul v-else class="pendencias">
      <li v-for="item in itens" :key="`${item.tipo}-${item.capituloNumero}`" class="pendencia">
        <RouterLink :to="`/capitulos/${item.capituloNumero}`" class="titulo">Cap. {{ item.capituloNumero }} · {{ item.titulo }}</RouterLink>
        <span class="etiqueta alerta">{{ DESCRICAO[item.tipo] }}</span>
        <small class="numeros">desde {{ desde(item.desde) }}</small>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pendencias { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-width: 860px; }
.pendencia {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--cartao);
  border: 1px solid var(--cartao-borda);
  border-radius: 8px;
}
.titulo { color: var(--texto); font-weight: 600; text-decoration: none; margin-right: auto; }
.titulo:hover { color: var(--destaque); }
small { color: var(--texto-suave); }
</style>
