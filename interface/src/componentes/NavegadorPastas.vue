<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { chamarApi } from "../api/cliente";

interface Listagem {
  caminho: string | null;
  pai: string | null;
  pastas: { nome: string; caminho: string }[];
  raizes: { nome: string; caminho: string }[];
}

const props = defineProps<{ modelValue: string | null }>();
const emitir = defineEmits<{ "update:modelValue": [caminho: string | null] }>();

const listagem = ref<Listagem | null>(null);
const digitado = ref(props.modelValue ?? "");
const erro = ref("");
const criando = ref(false);
const nomeNova = ref("");

async function abrir(caminho: string | null) {
  erro.value = "";
  try {
    const consulta = caminho ? `?caminho=${encodeURIComponent(caminho)}` : "";
    listagem.value = await chamarApi<Listagem>(`/api/sistema/pastas${consulta}`);
    digitado.value = listagem.value.caminho ?? "";
    emitir("update:modelValue", listagem.value.caminho);
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

async function criarPasta() {
  if (!listagem.value?.caminho) return;
  erro.value = "";
  try {
    await chamarApi("/api/sistema/pastas", {
      metodo: "POST",
      corpo: { caminhoPai: listagem.value.caminho, nome: nomeNova.value },
    });
    criando.value = false;
    nomeNova.value = "";
    await abrir(listagem.value.caminho);
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

watch(
  () => props.modelValue,
  (valor) => {
    if (valor && valor !== listagem.value?.caminho) void abrir(valor);
  },
);
onMounted(() => abrir(props.modelValue));
</script>

<template>
  <div class="navegador">
    <div class="raizes" v-if="listagem?.raizes.length">
      <button v-for="raiz in listagem.raizes" :key="raiz.caminho" type="button" class="botao" @click="abrir(raiz.caminho)">
        {{ raiz.nome }}
      </button>
    </div>

    <form class="ir-para" @submit.prevent="abrir(digitado)">
      <input v-model="digitado" aria-label="Caminho da pasta" placeholder="Cole ou digite um caminho" />
      <button type="submit" class="botao">Abrir</button>
    </form>

    <p v-if="erro" class="erro-texto">{{ erro }}</p>

    <div v-if="listagem?.caminho" class="pasta-atual">
      <div class="cabecalho">
        <button type="button" class="botao" :disabled="!listagem.pai" @click="abrir(listagem.pai)">Voltar</button>
        <span class="caminho" data-testid="caminho-atual">{{ listagem.caminho }}</span>
        <button type="button" class="botao" @click="criando = !criando">Nova pasta</button>
      </div>
      <form v-if="criando" class="nova" @submit.prevent="criarPasta">
        <input v-model="nomeNova" aria-label="Nome da nova pasta" placeholder="Nome da pasta" />
        <button type="submit" class="botao principal">Criar pasta</button>
      </form>
      <ul class="pastas">
        <li v-for="pasta in listagem.pastas" :key="pasta.caminho">
          <button type="button" @click="abrir(pasta.caminho)">{{ pasta.nome }}</button>
        </li>
        <li v-if="!listagem.pastas.length" class="vazio">Nenhuma subpasta aqui.</li>
      </ul>
    </div>
    <p v-else class="vazio">Escolha uma unidade ou cole um caminho para começar.</p>
  </div>
</template>

<style scoped>
.navegador { display: grid; gap: 10px; }
.raizes { display: flex; flex-wrap: wrap; gap: 6px; }
.ir-para, .nova { display: flex; gap: 8px; }
.pasta-atual {
  border: 1px solid var(--cartao-borda);
  border-radius: 8px;
  overflow: hidden;
}
.cabecalho {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--superficie);
}
.caminho {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.nova { padding: 8px; border-bottom: 1px solid var(--cartao-borda); }
.pastas {
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: 260px;
  overflow: auto;
}
.pastas button {
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
}
.pastas button:hover { background: var(--destaque-suave); }
.pastas .vazio { padding: 6px 8px; }
</style>
