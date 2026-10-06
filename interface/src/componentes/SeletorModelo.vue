<script setup lang="ts">
import { computed, onMounted } from "vue";
import { usarModelos } from "../estado/usarModelos";

const props = defineProps<{ modelValue: string; permitirPadrao: boolean; rotuloPadrao?: string; rotulo?: string }>();
const emitir = defineEmits<{ "update:modelValue": [valor: string] }>();
const { modelos, erro, recarregar, instalado } = usarModelos();

// Modelo escolhido antes e que não está mais no Ollama continua aparecendo, marcado.
const ausente = computed(() => (props.modelValue && !instalado(props.modelValue) ? props.modelValue : null));

onMounted(() => {
  if (!modelos.value.length) void recarregar();
});
</script>

<template>
  <label class="campo">
    <span>{{ rotulo ?? "Modelo do Ollama" }}</span>
    <select :value="modelValue" :aria-label="rotulo ?? 'Modelo do Ollama'" @change="emitir('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option v-if="permitirPadrao" value="">{{ rotuloPadrao ?? "Padrão do sistema" }}</option>
      <option v-if="ausente" :value="ausente">{{ ausente }} (não instalado)</option>
      <option v-for="modelo in modelos" :key="modelo.nome" :value="modelo.nome">
        {{ modelo.nome }} · {{ modelo.parametros }} {{ modelo.quantizacao }}
      </option>
    </select>
    <small v-if="erro" class="erro-texto">{{ erro }}</small>
  </label>
</template>
