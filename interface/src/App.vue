<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import MenuLateral from "./componentes/MenuLateral.vue";
import BarraTopo from "./componentes/BarraTopo.vue";
import Aviso from "./componentes/Aviso.vue";
import DialogoConfirmacao from "./componentes/DialogoConfirmacao.vue";
import { usarStatusSistema } from "./estado/usarStatusSistema";
import { usarProjetoAtual } from "./estado/usarProjetoAtual";
import { usarTarefas } from "./estado/usarTarefas";

const rota = useRoute();
const { status, recarregar: recarregarStatus } = usarStatusSistema();
const { recarregar: recarregarProjetos } = usarProjetoAtual();
const { recarregar: recarregarTarefas } = usarTarefas();

// A tela de boas-vindas ocupa a janela inteira, sem menu.
const telaCheia = computed(() => rota.path === "/boas-vindas");
const workspaceAusente = computed(() => Boolean(status.value?.workspace.configurada && !status.value.workspace.disponivel));

async function carregarDados() {
  if (!status.value?.workspace.disponivel) return;
  await Promise.all([recarregarProjetos().catch(() => {}), recarregarTarefas()]);
}

onMounted(carregarDados);
watch(() => status.value?.workspace.disponivel, carregarDados);
</script>

<template>
  <RouterView v-if="telaCheia" />
  <div v-else class="estrutura">
    <MenuLateral />
    <div class="area">
      <BarraTopo />
      <div v-if="workspaceAusente" class="faixa-erro" role="alert">
        <span v-if="status?.workspace.semBanco">
          A workspace em {{ status.workspace.caminho }} está sem o arquivo gangoy.db. Restaure-o de um backup ou aponte outro local.
        </span>
        <span v-else>Workspace não encontrada em {{ status?.workspace.caminho }}</span>
        <button type="button" class="botao" @click="recarregarStatus()">Tentar de novo</button>
        <RouterLink to="/boas-vindas" class="botao">Apontar outro local</RouterLink>
      </div>
      <main>
        <RouterView />
      </main>
    </div>
  </div>
  <Aviso />
  <DialogoConfirmacao />
</template>

<style scoped>
.estrutura {
  display: flex;
  min-height: 100vh;
}
.area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.faixa-erro {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 28px;
  background: var(--erro-fundo);
  color: var(--erro);
}
.faixa-erro span { margin-right: auto; }
</style>
