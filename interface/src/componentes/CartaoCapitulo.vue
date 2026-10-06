<script setup lang="ts">
import { computed } from "vue";
import type { Capitulo, Tarefa } from "../api/tipos";
import BarraProgresso from "./BarraProgresso.vue";

const props = defineProps<{ capitulo: Capitulo; tarefaAtiva: Tarefa | null }>();
const emitir = defineEmits<{ abrir: []; gerar: [] }>();

const situacao = computed(() => {
  if (props.tarefaAtiva) return props.tarefaAtiva.status === "na_fila" ? "Na fila" : props.tarefaAtiva.mensagem || "Executando";
  if (props.capitulo.status === "roteiro_gerado") return "Aguardando aprovação";
  if (props.capitulo.status === "aprovado") return "Roteiro aprovado";
  return `Alvo: ${props.capitulo.duracaoAlvoMinutos} min`;
});
</script>

<template>
  <article class="cartao-capitulo" :class="{ ocupado: tarefaAtiva }">
    <button type="button" class="abrir" @click="emitir('abrir')">
      <strong>Cap. {{ capitulo.numero }} · {{ capitulo.titulo }}</strong>
    </button>
    <BarraProgresso v-if="tarefaAtiva" :valor="tarefaAtiva.progresso" :rotulo="`Capítulo ${capitulo.numero}`" />
    <div class="rodape">
      <span
        class="etiqueta"
        :class="{ alerta: !tarefaAtiva && capitulo.status === 'roteiro_gerado', sucesso: capitulo.status === 'aprovado' }"
      >
        {{ situacao }}
      </span>
      <button
        v-if="capitulo.status === 'planejado' && !tarefaAtiva"
        type="button"
        class="botao gerar"
        @click="emitir('gerar')"
      >
        Gerar roteiro
      </button>
    </div>
  </article>
</template>

<style scoped>
.cartao-capitulo {
  display: grid;
  gap: 8px;
  padding: 10px 11px;
  border-radius: 8px;
  background: var(--cartao);
  border: 1px solid var(--cartao-borda);
}
/* O único destaque do quadro: o cartão que está sendo trabalhado agora. */
.cartao-capitulo.ocupado { border-color: var(--destaque); }
.abrir {
  background: none;
  border: 0;
  padding: 0;
  text-align: left;
  cursor: pointer;
  color: inherit;
}
.abrir:hover strong { color: var(--destaque); }
.rodape { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.gerar { padding: 3px 9px; font-size: 12px; }
</style>
