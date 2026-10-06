<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usarModelos } from "../estado/usarModelos";

// O Select não aceita valor vazio; o "padrão do sistema" (valor "") usa este valor no lugar.
const PADRAO = "__padrao__";

const props = defineProps<{ modelValue: string; permitirPadrao: boolean; rotuloPadrao?: string; rotulo?: string }>();
const emitir = defineEmits<{ "update:modelValue": [valor: string] }>();
const { modelos, erro, recarregar, instalado } = usarModelos();

const nome = computed(() => props.rotulo ?? "Modelo do Ollama");
const valor = computed(() => props.modelValue || (props.permitirPadrao ? PADRAO : ""));

// Modelo escolhido antes e que não está mais no Ollama continua aparecendo, marcado.
const ausente = computed(() => (props.modelValue && !instalado(props.modelValue) ? props.modelValue : null));

function escolher(escolhido: unknown) {
  emitir("update:modelValue", escolhido === PADRAO ? "" : String(escolhido));
}

onMounted(() => {
  if (!modelos.value.length) void recarregar();
});
</script>

<template>
  <div class="grid gap-2">
    <Label>{{ nome }}</Label>
    <Select :model-value="valor" @update:model-value="escolher">
      <SelectTrigger :aria-label="nome" class="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-if="permitirPadrao" :value="PADRAO">{{ rotuloPadrao ?? "Padrão do sistema" }}</SelectItem>
        <SelectItem v-if="ausente" :value="ausente">{{ ausente }} (não instalado)</SelectItem>
        <SelectItem v-for="modelo in modelos" :key="modelo.nome" :value="modelo.nome">
          {{ modelo.nome }} · {{ modelo.parametros }} {{ modelo.quantizacao }}
        </SelectItem>
      </SelectContent>
    </Select>
    <p v-if="erro" class="text-sm text-destructive">{{ erro }}</p>
  </div>
</template>
