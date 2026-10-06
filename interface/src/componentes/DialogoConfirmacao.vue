<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { usarConfirmacao } from "../estado/usarConfirmacao";

const { pedido } = usarConfirmacao();
const dialogo = ref<HTMLDialogElement | null>(null);

watch(pedido, async (atual) => {
  await nextTick();
  if (atual && !dialogo.value?.open) dialogo.value?.showModal();
  if (!atual && dialogo.value?.open) dialogo.value.close();
});
</script>

<template>
  <dialog ref="dialogo" class="dialogo" @cancel.prevent="pedido?.responder(false)">
    <template v-if="pedido">
      <h2>{{ pedido.titulo }}</h2>
      <p class="texto">{{ pedido.texto }}</p>
      <div class="acoes">
        <button type="button" class="botao" @click="pedido.responder(false)">Voltar</button>
        <button type="button" class="botao principal" @click="pedido.responder(true)">{{ pedido.botao }}</button>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.dialogo {
  border: 1px solid var(--cartao-borda);
  border-radius: 12px;
  background: var(--cartao);
  color: var(--texto);
  padding: 20px 22px;
  width: min(460px, 92vw);
  box-shadow: var(--sombra-flutuante);
}
.dialogo::backdrop { background: rgba(0, 0, 0, 0.5); }
.texto { color: var(--texto-suave); white-space: pre-line; }
.acoes { display: flex; justify-content: flex-end; gap: 8px; }
</style>
