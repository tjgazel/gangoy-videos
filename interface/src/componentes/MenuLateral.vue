<script setup lang="ts">
import TrocaTema from "./TrocaTema.vue";

const itens = [
  { rota: "/producao", texto: "Produção" },
  { rota: "/revisao", texto: "Revisão" },
  { rota: "/dossie", texto: "Dossiê" },
  { rota: "/projetos", texto: "Projetos" },
  { rota: "/configuracoes", texto: "Configurações" },
];
</script>

<template>
  <aside class="menu-lateral">
    <div class="marca">
      <span class="simbolo" aria-hidden="true"></span>
      <span>Gangoy Vídeos</span>
    </div>
    <nav aria-label="Menu principal">
      <RouterLink v-for="item in itens" :key="item.rota" :to="item.rota" class="item" active-class="ativo">
        {{ item.texto }}
      </RouterLink>
    </nav>
    <TrocaTema class="rodape" />
  </aside>
</template>

<style scoped>
.menu-lateral {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 200px;
  flex-shrink: 0;
  padding: 16px 10px;
  background: var(--menu);
  border-right: 1px solid var(--menu-borda);
  color: var(--menu-texto);
  min-height: 100vh;
  position: sticky;
  top: 0;
}
.marca {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 8px 18px;
  color: #fff;
  font-weight: 650;
  font-size: 15px;
}
/* Quadro de filme estilizado: a única marca visual do produto. */
.simbolo {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background:
    linear-gradient(90deg, transparent 3px, #0b0d12 3px 4px, transparent 4px 14px, #0b0d12 14px 15px, transparent 15px),
    linear-gradient(135deg, #3b82f6, #22d3ee);
}
nav {
  display: grid;
  gap: 2px;
}
.item {
  padding: 8px 10px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
}
.item:hover { color: var(--menu-texto-ativo); }
.item.ativo {
  background: var(--menu-item-ativo);
  color: var(--menu-texto-ativo);
  box-shadow: inset 2px 0 0 var(--destaque);
}
[data-tema="claro"] .item.ativo { box-shadow: none; font-weight: 600; }
.rodape { margin-top: auto; }
</style>
