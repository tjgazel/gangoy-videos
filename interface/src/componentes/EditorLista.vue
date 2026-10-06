<script setup lang="ts" generic="T">
// Lista editável: adicionar, remover e reordenar. O conteúdo de cada item vem do slot.
const props = defineProps<{ modelValue: T[]; rotuloItem: string; novo: () => T }>();
const emitir = defineEmits<{ "update:modelValue": [itens: T[]] }>();

function atualizar(itens: T[]) {
  emitir("update:modelValue", itens);
}

function mover(indice: number, deslocamento: number) {
  const itens = [...props.modelValue];
  const alvo = indice + deslocamento;
  if (alvo < 0 || alvo >= itens.length) return;
  [itens[indice], itens[alvo]] = [itens[alvo] as T, itens[indice] as T];
  atualizar(itens);
}
</script>

<template>
  <div class="editor-lista">
    <fieldset v-for="(item, indice) in modelValue" :key="indice" class="item">
      <legend>{{ rotuloItem }} {{ indice + 1 }}</legend>
      <slot name="item" :item="item" :indice="indice" />
      <div class="acoes">
        <button type="button" class="botao" :disabled="indice === 0" @click="mover(indice, -1)">Subir</button>
        <button type="button" class="botao" :disabled="indice === modelValue.length - 1" @click="mover(indice, 1)">Descer</button>
        <button
          type="button"
          class="botao perigo"
          :aria-label="`Remover ${rotuloItem.toLowerCase()} ${indice + 1}`"
          @click="atualizar(modelValue.filter((_, i) => i !== indice))"
        >
          Remover
        </button>
      </div>
    </fieldset>
    <button type="button" class="botao" @click="atualizar([...modelValue, novo()])">Adicionar {{ rotuloItem.toLowerCase() }}</button>
  </div>
</template>

<style scoped>
.editor-lista { display: grid; gap: 10px; }
.item {
  display: grid;
  gap: 10px;
  border: 1px solid var(--cartao-borda);
  border-radius: 8px;
  padding: 10px 12px 12px;
  margin: 0;
}
legend { color: var(--texto-suave); font-size: 13px; padding: 0 4px; }
.acoes { display: flex; gap: 6px; justify-content: flex-end; }
.editor-lista > .botao { justify-self: start; }
</style>
