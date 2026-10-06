<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { chamarApi } from "../api/cliente";
import NavegadorPastas from "../componentes/NavegadorPastas.vue";
import { usarStatusSistema } from "../estado/usarStatusSistema";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";

const roteador = useRouter();
const { status, recarregar } = usarStatusSistema();
const { recarregar: recarregarProjetos } = usarProjetoAtual();
const pasta = ref<string | null>(null);
const erro = ref("");
const ocupado = ref(false);

async function usar(rota: "/api/workspace" | "/api/workspace/apontar") {
  if (!pasta.value) return;
  erro.value = "";
  ocupado.value = true;
  try {
    const corpo = rota === "/api/workspace" ? { local: pasta.value } : { caminho: pasta.value };
    await chamarApi(rota, { metodo: "POST", corpo });
    await recarregar();
    await recarregarProjetos().catch(() => {});
    await roteador.push("/producao");
  } catch (falha) {
    erro.value = (falha as Error).message;
  } finally {
    ocupado.value = false;
  }
}

void recarregar().catch(() => {});
</script>

<template>
  <div class="boas-vindas">
    <section class="cartao">
      <div class="marca">
        <span class="simbolo" aria-hidden="true"></span>
        <span>Gangoy Vídeos</span>
      </div>
      <h1>Escolha onde guardar seus projetos</h1>
      <p class="explicacao">
        O sistema cria a pasta <strong>Gangoy-workspace</strong> no local escolhido. Nela ficam o banco, os roteiros,
        as imagens e os vídeos de todos os projetos. Para fazer backup ou levar para outro computador, basta copiar essa pasta.
      </p>
      <p v-if="status?.existemDadosAntigos" class="destaque">
        Os projetos que já existem em dados/ serão trazidos para a workspace.
      </p>

      <NavegadorPastas v-model="pasta" />

      <p class="aviso-rede">Evite pastas de rede (compartilhamentos do Windows, NAS): o banco de dados pode corromper.</p>
      <p v-if="erro" class="erro-texto">{{ erro }}</p>

      <div class="acoes">
        <button type="button" class="botao" :disabled="!pasta || ocupado" @click="usar('/api/workspace/apontar')">
          Abrir workspace existente
        </button>
        <button type="button" class="botao principal" :disabled="!pasta || ocupado" @click="usar('/api/workspace')">
          Usar esta pasta
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.boas-vindas {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
}
.cartao {
  width: min(720px, 100%);
  display: grid;
  gap: 14px;
  background: var(--cartao);
  border: 1px solid var(--cartao-borda);
  border-radius: 14px;
  padding: 28px 30px;
}
.marca { display: flex; align-items: center; gap: 9px; font-weight: 650; color: var(--texto-suave); }
.simbolo {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background:
    linear-gradient(90deg, transparent 3px, #0b0d12 3px 4px, transparent 4px 14px, #0b0d12 14px 15px, transparent 15px),
    linear-gradient(135deg, #3b82f6, #22d3ee);
}
h1 { font-size: 26px; }
.explicacao { color: var(--texto-suave); margin: 0; max-width: 64ch; }
.destaque { margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--destaque-suave); }
.aviso-rede { margin: 0; color: var(--alerta); font-size: 13px; }
.acoes { display: flex; justify-content: flex-end; gap: 8px; }
</style>
