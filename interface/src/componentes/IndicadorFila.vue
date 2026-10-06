<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chamarApi } from "../api/cliente";
import { nomeDaTarefa, usarTarefas } from "../estado/usarTarefas";
import { avisar } from "../estado/usarAvisos";
import BarraProgresso from "./BarraProgresso.vue";
import type { Tarefa } from "../api/tipos";

const { tarefas, executando, aguardando } = usarTarefas();
const recentes = computed(() => tarefas.value.slice(0, 12));

const STATUS: Record<Tarefa["status"], string> = {
  na_fila: "Aguardando",
  executando: "Executando",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
};

async function agir(tarefa: Tarefa, acao: "cancelar" | "repetir") {
  try {
    await chamarApi(`/api/tarefas/${tarefa.id}/${acao}`, { metodo: "POST" });
  } catch (erro) {
    avisar((erro as Error).message, "erro");
  }
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm">
        <span class="size-2 rounded-full" :class="executando > 0 ? 'animate-pulse bg-green-500' : 'bg-muted-foreground/40'" aria-hidden="true"></span>
        <span class="tabular-nums">Fila: {{ executando }} executando · {{ aguardando }} aguardando</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-96" aria-label="Fila de tarefas">
      <p v-if="!recentes.length" class="text-sm text-muted-foreground">Nenhuma tarefa ainda.</p>
      <ul class="grid max-h-96 gap-3 overflow-y-auto">
        <li v-for="tarefa in recentes" :key="tarefa.id" class="grid gap-1.5">
          <div class="flex items-center justify-between gap-2">
            <strong class="text-sm">{{ nomeDaTarefa(tarefa) }}</strong>
            <Badge :variant="tarefa.status === 'falhou' ? 'destructive' : tarefa.status === 'concluida' ? 'default' : 'secondary'">
              {{ STATUS[tarefa.status] }}
            </Badge>
          </div>
          <BarraProgresso v-if="tarefa.status === 'executando'" :valor="tarefa.progresso" :rotulo="nomeDaTarefa(tarefa)" />
          <small v-if="tarefa.status === 'executando' && tarefa.mensagem" class="text-muted-foreground">{{ tarefa.mensagem }}</small>
          <small v-if="tarefa.status === 'falhou'" class="text-destructive">{{ tarefa.erro }}</small>
          <div class="flex gap-2">
            <Button v-if="tarefa.status === 'na_fila' || tarefa.status === 'executando'" variant="outline" size="sm" @click="agir(tarefa, 'cancelar')">
              Cancelar
            </Button>
            <Button v-if="tarefa.status === 'falhou' || tarefa.status === 'cancelada'" variant="outline" size="sm" @click="agir(tarefa, 'repetir')">
              Tentar de novo
            </Button>
          </div>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
