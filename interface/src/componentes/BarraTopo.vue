<script setup lang="ts">
import SeletorProjeto from "./SeletorProjeto.vue";
import IndicadorFila from "./IndicadorFila.vue";
import { usarStatusSistema } from "../estado/usarStatusSistema";

const { status } = usarStatusSistema();
</script>

<template>
  <header class="barra-topo">
    <SeletorProjeto v-if="status?.workspace.disponivel" />
    <span class="espaco"></span>
    <IndicadorFila v-if="status?.workspace.disponivel" />
    <div v-if="status" class="estados">
      <span class="estado" :title="status.ollama.online ? 'Ollama online' : 'Ollama fora do ar'">
        <span class="ponto" :class="status.ollama.online ? 'ok' : 'falha'" aria-hidden="true"></span>Ollama
      </span>
      <span class="estado" :title="status.workspace.disponivel ? 'Workspace disponível' : 'Workspace não encontrada'">
        <span class="ponto" :class="status.workspace.disponivel ? 'ok' : 'falha'" aria-hidden="true"></span>Workspace
      </span>
    </div>
  </header>
</template>

<style scoped>
.barra-topo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 28px;
  border-bottom: 1px solid var(--borda);
  background: var(--fundo);
  position: sticky;
  top: 0;
  z-index: 10;
}
[data-tema="claro"] .barra-topo { background: var(--cartao); }
.espaco { flex: 1; }
.estados { display: flex; gap: 14px; color: var(--texto-suave); font-size: 13px; }
.estado { display: inline-flex; align-items: center; gap: 6px; }
.ponto { width: 8px; height: 8px; border-radius: 50%; }
.ponto.ok { background: var(--sucesso); }
.ponto.falha { background: var(--erro); }
</style>
