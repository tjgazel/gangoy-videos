<script setup lang="ts">
import { usarTema } from "../estado/usarTema";

const { tema, definir } = usarTema();
</script>

<template>
  <div class="troca-tema" role="group" aria-label="Tema">
    <button type="button" :aria-pressed="tema === 'escuro'" @click="definir('escuro')">☾ Escuro</button>
    <button type="button" :aria-pressed="tema === 'claro'" @click="definir('claro')">☀ Claro</button>
  </div>
</template>

<style scoped>
.troca-tema {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
}
button {
  border: 0;
  border-radius: 6px;
  padding: 5px 0;
  font-size: 12px;
  background: transparent;
  color: var(--menu-texto);
  cursor: pointer;
}
button[aria-pressed="true"] {
  background: var(--menu-item-ativo);
  color: var(--menu-texto-ativo);
}
</style>
