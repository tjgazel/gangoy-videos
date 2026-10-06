<script setup lang="ts" generic="T">
// Lista editável: adicionar, remover e reordenar. O conteúdo de cada item vem do slot.
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";

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
  <div class="grid gap-3">
    <fieldset v-for="(item, indice) in modelValue" :key="indice" class="grid gap-3 rounded-xl border bg-card p-4">
      <legend class="px-1 text-sm font-medium text-muted-foreground">{{ rotuloItem }} {{ indice + 1 }}</legend>
      <slot name="item" :item="item" :indice="indice" />
      <div class="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" :disabled="indice === 0" @click="mover(indice, -1)"><ArrowUp /> Subir</Button>
        <Button type="button" variant="outline" size="sm" :disabled="indice === modelValue.length - 1" @click="mover(indice, 1)"><ArrowDown /> Descer</Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          :aria-label="`Remover ${rotuloItem.toLowerCase()} ${indice + 1}`"
          @click="atualizar(modelValue.filter((_, i) => i !== indice))"
        >
          <Trash2 /> Remover
        </Button>
      </div>
    </fieldset>
    <Button type="button" variant="outline" class="justify-self-start" @click="atualizar([...modelValue, novo()])">
      <Plus /> Adicionar {{ rotuloItem.toLowerCase() }}
    </Button>
  </div>
</template>
