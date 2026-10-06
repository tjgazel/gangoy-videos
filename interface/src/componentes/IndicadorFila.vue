<script setup lang="ts">
import { computed, ref } from "vue";
import { chamarApi } from "../api/cliente";
import { nomeDaTarefa, usarTarefas } from "../estado/usarTarefas";
import { avisar } from "../estado/usarAvisos";
import BarraProgresso from "./BarraProgresso.vue";
import type { Tarefa } from "../api/tipos";

const { tarefas, executando, aguardando } = usarTarefas();
const aberto = ref(false);
const recentes = computed(() => tarefas.value.slice(0, 12));

const STATUS: Record<Tarefa["status"], string> = {
  na_fila: "Aguardando",
  executando: "Executando",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
};

async function agir(tarefa: Tarefa, acao: "cancelar" | "repetir") {
  try {
    await chamarApi(`/api/tarefas/${tarefa.id}/${acao}`, { metodo: "POST" });
  } catch (erro) {
    avisar((erro as Error).message, "erro");
  }
}
</script>

<template>
  <div class="indicador">
    <button type="button" class="botao" :aria-expanded="aberto" @click="aberto = !aberto">
      <span class="ponto-fila" :class="{ ativo: executando > 0 }" aria-hidden="true"></span>
      <span class="numeros">Fila: {{ executando }} executando · {{ aguardando }} aguardando</span>
    </button>
    <div v-if="aberto" class="lista" role="dialog" aria-label="Fila de tarefas">
      <p v-if="!recentes.length" class="vazio">Nenhuma tarefa ainda.</p>
      <ul>
        <li v-for="tarefa in recentes" :key="tarefa.id">
          <div class="linha">
            <strong>{{ nomeDaTarefa(tarefa) }}</strong>
            <span
              class="etiqueta"
              :class="{ sucesso: tarefa.status === 'concluida', erro: tarefa.status === 'falhou', alerta: tarefa.status === 'cancelada' }"
            >
              {{ STATUS[tarefa.status] }}
            </span>
          </div>
          <BarraProgresso v-if="tarefa.status === 'executando'" :valor="tarefa.progresso" :rotulo="nomeDaTarefa(tarefa)" />
          <small v-if="tarefa.status === 'executando' && tarefa.mensagem">{{ tarefa.mensagem }}</small>
          <small v-if="tarefa.status === 'falhou'" class="erro-texto">{{ tarefa.erro }}</small>
          <div class="acoes">
            <button
              v-if="tarefa.status === 'na_fila' || tarefa.status === 'executando'"
              type="button"
              class="botao"
              @click="agir(tarefa, 'cancelar')"
            >
              Cancelar
            </button>
            <button
              v-if="tarefa.status === 'falhou' || tarefa.status === 'cancelada'"
              type="button"
              class="botao"
              @click="agir(tarefa, 'repetir')"
            >
              Tentar de novo
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.indicador { position: relative; }
.ponto-fila {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--texto-suave);
}
.ponto-fila.ativo { background: var(--destaque); box-shadow: 0 0 0 3px var(--destaque-suave); }
.lista {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 360px;
  max-height: 420px;
  overflow: auto;
  z-index: 20;
  background: var(--cartao);
  border: 1px solid var(--cartao-borda);
  border-radius: 10px;
  box-shadow: var(--sombra-flutuante);
  padding: 8px;
}
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
li { display: grid; gap: 4px; padding: 8px; border-radius: 6px; }
li:hover { background: var(--superficie); }
.linha { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
small { color: var(--texto-suave); }
.acoes { display: flex; gap: 6px; }
.acoes:empty { display: none; }
</style>
