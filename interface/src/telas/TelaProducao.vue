<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { chamarApi } from "../api/cliente";
import ColunaQuadro from "../componentes/ColunaQuadro.vue";
import CartaoCapitulo from "../componentes/CartaoCapitulo.vue";
import { COLUNAS, colunaDoCapitulo } from "../estado/colunasQuadro";
import { usarCapitulos } from "../estado/usarCapitulos";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";
import { usarTarefas } from "../estado/usarTarefas";
import { avisar } from "../estado/usarAvisos";

const roteador = useRouter();
const { projetoAtual } = usarProjetoAtual();
const { capitulos, carregado } = usarCapitulos();
const { ativaDoCapitulo, recarregar: recarregarTarefas } = usarTarefas();

const porColuna = computed(() =>
  COLUNAS.map((coluna) => ({
    ...coluna,
    itens: capitulos.value
      .map((capitulo) => ({ capitulo, tarefa: ativaDoCapitulo(capitulo.projetoId, capitulo.numero) }))
      .filter(({ capitulo, tarefa }) => colunaDoCapitulo(capitulo, tarefa) === coluna.id),
  })),
);

async function gerar(numero: number) {
  if (!projetoAtual.value) return;
  try {
    await chamarApi(`/api/projetos/${projetoAtual.value.id}/capitulos/${numero}/roteiro`, { metodo: "POST" });
    await recarregarTarefas();
  } catch (falha) {
    avisar((falha as Error).message, "erro");
  }
}
</script>

<template>
  <section class="tela">
    <header class="tela-cabecalho">
      <h1>Produção</h1>
      <RouterLink v-if="projetoAtual && capitulos.length" to="/dossie" class="botao">Ver dossiê</RouterLink>
    </header>

    <p v-if="!projetoAtual" class="vazio">Crie um projeto na tela Projetos para começar.</p>

    <div v-else-if="carregado && !capitulos.length" class="painel inicio">
      <h2>{{ projetoAtual.nome }} ainda não tem capítulos</h2>
      <p class="vazio">Escreva o enredo e o sistema propõe sinopse, personagens e a divisão em capítulos. Você revisa antes de gravar.</p>
      <RouterLink to="/producao/planejamento" class="botao principal">Planejar história</RouterLink>
    </div>

    <div v-else class="quadro">
      <ColunaQuadro v-for="coluna in porColuna" :key="coluna.id" :titulo="coluna.titulo" :quantidade="coluna.itens.length">
        <CartaoCapitulo
          v-for="{ capitulo, tarefa } in coluna.itens"
          :key="capitulo.id"
          :capitulo="capitulo"
          :tarefa-ativa="tarefa"
          @abrir="roteador.push(`/capitulos/${capitulo.numero}`)"
          @gerar="gerar(capitulo.numero)"
        />
      </ColunaQuadro>
    </div>
  </section>
</template>

<style scoped>
.quadro {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 12px;
  align-items: start;
}
.inicio { display: grid; gap: 10px; justify-items: start; max-width: 640px; }
@media (max-width: 1100px) {
  .quadro { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
}
</style>
