<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { chamarApi } from "../api/cliente";
import { BookOpen, Clapperboard, Sparkles } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import CabecalhoTela from "../componentes/CabecalhoTela.vue";
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
  <section class="mx-auto grid max-w-7xl gap-6">
    <CabecalhoTela titulo="Produção">
      <Button v-if="projetoAtual && capitulos.length" as-child variant="outline">
        <RouterLink to="/dossie"><BookOpen /> Ver dossiê</RouterLink>
      </Button>
    </CabecalhoTela>

    <p v-if="!projetoAtual" class="text-muted-foreground">Crie um projeto na tela Projetos para começar.</p>

    <Empty v-else-if="carregado && !capitulos.length" class="border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Clapperboard /></EmptyMedia>
        <EmptyTitle>{{ projetoAtual.nome }} ainda não tem capítulos</EmptyTitle>
        <EmptyDescription>Escreva o enredo e o sistema propõe sinopse, personagens e a divisão em capítulos. Você revisa antes de gravar.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button as-child><RouterLink to="/producao/planejamento"><Sparkles /> Planejar história</RouterLink></Button>
      </EmptyContent>
    </Empty>

    <div v-else class="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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
