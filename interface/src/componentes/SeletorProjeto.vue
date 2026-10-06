<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";

const { projetos, projetoAtualId } = usarProjetoAtual();
</script>

<template>
  <Select v-if="projetos.length" v-model="projetoAtualId">
    <SelectTrigger aria-label="Projeto" class="min-w-44">
      <SelectValue placeholder="Escolha um projeto" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="projeto in projetos" :key="projeto.id" :value="projeto.id">{{ projeto.nome }}</SelectItem>
    </SelectContent>
  </Select>
  <Button v-else as-child variant="outline">
    <RouterLink to="/projetos">Criar o primeiro projeto</RouterLink>
  </Button>
</template>
