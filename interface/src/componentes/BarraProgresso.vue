<script setup lang="ts">
import { computed } from "vue";
import { Progress } from "@/components/ui/progress";

const props = defineProps<{ valor: number; rotulo?: string }>();
// Mantém um pedaço visível mesmo no começo da tarefa.
const preenchido = computed(() => Math.max(3, Math.min(100, props.valor)));
</script>

<template>
  <Progress :model-value="preenchido" :aria-label="rotulo ?? 'Progresso'" />
</template>
