<script setup lang="ts">
import { usarProjetoAtual } from "../estado/usarProjetoAtual";

const { projetos, projetoAtualId } = usarProjetoAtual();
</script>

<template>
  <select v-if="projetos.length" v-model="projetoAtualId" class="seletor" aria-label="Projeto">
    <option v-for="projeto in projetos" :key="projeto.id" :value="projeto.id">{{ projeto.nome }}</option>
  </select>
  <RouterLink v-else to="/projetos" class="botao">Criar o primeiro projeto</RouterLink>
</template>

<style scoped>
.seletor {
  width: auto;
  min-width: 200px;
  padding: 5px 10px;
}
</style>
