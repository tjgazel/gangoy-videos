<script setup lang="ts">
defineProps<{ titulo: string; quantidade: number }>();
</script>

<template>
  <section class="coluna" :aria-label="titulo">
    <header>
      <h2>{{ titulo }}</h2>
      <span class="numeros">{{ quantidade }}</span>
    </header>
    <div class="cartoes">
      <slot />
      <p v-if="quantidade === 0" class="vazio">Nenhum capítulo aqui.</p>
    </div>
  </section>
</template>

<style scoped>
.coluna {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: var(--superficie);
  min-height: 240px;
}
header { display: flex; justify-content: space-between; align-items: baseline; color: var(--texto-suave); }
h2 { font-size: 13px; font-weight: 600; }
.cartoes { display: grid; gap: 8px; }
.vazio { font-size: 13px; }
</style>
