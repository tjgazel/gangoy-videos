<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { TriangleAlert } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import MenuApp from "./componentes/MenuApp.vue";
import CabecalhoApp from "./componentes/CabecalhoApp.vue";
import Aviso from "./componentes/Aviso.vue";
import DialogoConfirmacao from "./componentes/DialogoConfirmacao.vue";
import { usarStatusSistema } from "./estado/usarStatusSistema";
import { usarProjetoAtual } from "./estado/usarProjetoAtual";
import { usarTarefas } from "./estado/usarTarefas";
import { usarModoTema } from "./estado/usarModoTema";

const rota = useRoute();
const { status, recarregar: recarregarStatus } = usarStatusSistema();
const { recarregar: recarregarProjetos } = usarProjetoAtual();
const { recarregar: recarregarTarefas } = usarTarefas();
usarModoTema();

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
  <SidebarProvider v-else>
    <MenuApp />
    <SidebarInset class="h-svh overflow-hidden">
      <CabecalhoApp />
      <Alert v-if="workspaceAusente" variant="destructive" class="m-4 mb-0 w-auto">
        <TriangleAlert />
        <AlertDescription class="flex flex-wrap items-center gap-2">
          <span class="mr-auto">
            <template v-if="status?.workspace.semBanco">
              A workspace em {{ status.workspace.caminho }} está sem o arquivo gangoy.db. Restaure-o de um backup ou aponte outro local.
            </template>
            <template v-else>Workspace não encontrada em {{ status?.workspace.caminho }}</template>
          </span>
          <Button variant="outline" size="sm" @click="recarregarStatus()">Tentar de novo</Button>
          <Button as-child variant="outline" size="sm"><RouterLink to="/boas-vindas">Apontar outro local</RouterLink></Button>
        </AlertDescription>
      </Alert>
      <div data-testid="conteudo" class="flex-1 overflow-y-auto p-4 md:p-6">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
  <Aviso />
  <DialogoConfirmacao />
</template>
