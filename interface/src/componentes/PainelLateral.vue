<script setup lang="ts">
defineProps<{ aberto: boolean; titulo: string }>();
const emitir = defineEmits<{ fechar: [] }>();
</script>

<template>
  <div v-if="aberto" class="fundo" @click.self="emitir('fechar')" @keydown.esc="emitir('fechar')">
    <aside class="painel-lateral" role="dialog" :aria-label="titulo">
      <header>
        <h2>{{ titulo }}</h2>
        <button type="button" class="fechar" aria-label="Fechar" @click="emitir('fechar')">×</button>
      </header>
      <div class="conteudo">
        <slot />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.fundo {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 30;
  display: flex;
  justify-content: flex-end;
}
.painel-lateral {
  width: min(480px, 100vw);
  height: 100%;
  overflow: auto;
  background: var(--cartao);
  border-left: 1px solid var(--cartao-borda);
  box-shadow: var(--sombra-flutuante);
  display: flex;
  flex-direction: column;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--cartao-borda);
}
.fechar {
  background: none;
  border: 0;
  color: var(--texto-suave);
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
}
.conteudo { padding: 18px 20px; }
</style>
