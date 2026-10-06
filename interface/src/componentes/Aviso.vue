<script setup lang="ts">
import { usarAvisos } from "../estado/usarAvisos";

const { avisos, fechar } = usarAvisos();
</script>

<template>
  <div class="avisos">
    <div
      v-for="aviso in avisos"
      :key="aviso.id"
      class="aviso"
      :class="aviso.tipo"
      :role="aviso.tipo === 'erro' ? 'alert' : 'status'"
    >
      <span>{{ aviso.texto }}</span>
      <button type="button" aria-label="Fechar aviso" @click="fechar(aviso.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.avisos {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: grid;
  gap: 8px;
  z-index: 50;
  max-width: 420px;
}
.aviso {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--cartao);
  border: 1px solid var(--cartao-borda);
  border-left: 3px solid var(--sucesso);
  box-shadow: var(--sombra-flutuante);
}
.aviso.erro { border-left-color: var(--erro); }
.aviso span { flex: 1; }
button {
  background: none;
  border: 0;
  color: var(--texto-suave);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
</style>
