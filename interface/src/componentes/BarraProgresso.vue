<script setup lang="ts">
defineProps<{ valor: number; rotulo?: string }>();
</script>

<template>
  <div
    class="barra"
    role="progressbar"
    :aria-valuenow="valor"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="rotulo ?? 'Progresso'"
  >
    <span :style="{ width: `${Math.max(3, Math.min(100, valor))}%` }"></span>
  </div>
</template>

<style scoped>
.barra {
  height: 4px;
  border-radius: 2px;
  background: var(--cartao-borda);
  overflow: hidden;
}
span {
  display: block;
  height: 100%;
  background: var(--destaque);
  transition: width 0.4s ease;
}
</style>
