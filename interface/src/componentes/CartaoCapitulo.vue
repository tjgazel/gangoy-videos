<script setup lang="ts">
import { computed } from "vue";
import type { Capitulo, Tarefa } from "../api/tipos";
import { Sparkles } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import BarraProgresso from "./BarraProgresso.vue";

const props = defineProps<{ capitulo: Capitulo; tarefaAtiva: Tarefa | null }>();
const emitir = defineEmits<{ abrir: []; gerar: [] }>();

const situacao = computed(() => {
  if (props.tarefaAtiva) return props.tarefaAtiva.status === "na_fila" ? "Na fila" : props.tarefaAtiva.mensagem || "Executando";
  if (props.capitulo.status === "roteiro_gerado") return "Aguardando aprovação";
  if (props.capitulo.status === "aprovado") return "Roteiro aprovado";
  return `Alvo: ${props.capitulo.duracaoAlvoMinutos} min`;
});
</script>
<template>
  <Card role="article" size="sm" :class="tarefaAtiva ? 'ring-primary/40' : ''">
    <CardContent class="grid gap-2">
      <button type="button" class="text-left font-medium hover:underline" @click="emitir('abrir')">
        Cap. {{ capitulo.numero }} · {{ capitulo.titulo }}
      </button>
      <BarraProgresso v-if="tarefaAtiva" :valor="tarefaAtiva.progresso" :rotulo="`Capítulo ${capitulo.numero}`" />
      <div class="flex items-center justify-between gap-2">
        <Badge :variant="capitulo.status === 'aprovado' ? 'default' : !tarefaAtiva && capitulo.status === 'roteiro_gerado' ? 'outline' : 'secondary'">
          {{ situacao }}
        </Badge>
        <Button v-if="capitulo.status === 'planejado' && !tarefaAtiva" size="sm" @click="emitir('gerar')">
          <Sparkles /> Gerar roteiro
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
