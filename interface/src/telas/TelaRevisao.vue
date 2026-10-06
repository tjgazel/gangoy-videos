<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { chamarApi } from "../api/cliente";
import { aoEvento } from "../api/eventos";
import type { ItemRevisao } from "../api/tipos";
import { ClipboardCheck } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import CabecalhoTela from "../componentes/CabecalhoTela.vue";
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
  <section class="mx-auto grid max-w-3xl gap-6">
    <CabecalhoTela titulo="Revisão" />
    <p v-if="!projetoAtual" class="text-muted-foreground">Escolha um projeto no topo da tela.</p>
    <Empty v-else-if="carregado && !itens.length" class="border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
        <EmptyTitle>Nada esperando por você.</EmptyTitle>
        <EmptyDescription>Gere roteiros na tela Produção.</EmptyDescription>
      </EmptyHeader>
    </Empty>
    <ul v-else class="grid gap-2">
      <li v-for="item in itens" :key="`${item.tipo}-${item.capituloNumero}`">
        <Card size="sm">
          <CardContent class="flex flex-wrap items-center gap-3">
            <RouterLink :to="`/capitulos/${item.capituloNumero}`" class="mr-auto font-medium hover:underline">
              Cap. {{ item.capituloNumero }} · {{ item.titulo }}
            </RouterLink>
            <Badge variant="outline">{{ DESCRICAO[item.tipo] }}</Badge>
            <small class="text-muted-foreground tabular-nums">desde {{ desde(item.desde) }}</small>
          </CardContent>
        </Card>
      </li>
    </ul>
  </section>
</template>
