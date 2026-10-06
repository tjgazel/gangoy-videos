<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { chamarApi } from "../api/cliente";
import type { Personagem, Planejamento, Tarefa } from "../api/tipos";
import EditorLista from "../componentes/EditorLista.vue";
import BarraProgresso from "../componentes/BarraProgresso.vue";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";
import { usarTarefas } from "../estado/usarTarefas";
import { avisar } from "../estado/usarAvisos";

const roteador = useRouter();
const { projetoAtual } = usarProjetoAtual();
const { tarefas, aguardar } = usarTarefas();

const enredo = ref("");
const proposta = ref<Planejamento | null>(null);
const tarefaId = ref<number | null>(null);
const erro = ref("");
const tarefa = computed(() => tarefas.value.find((t) => t.id === tarefaId.value) ?? null);
const gerando = computed(() => tarefa.value?.status === "na_fila" || tarefa.value?.status === "executando");

const novoPersonagem = (): Personagem => ({ nome: "", papel: "", aparenciaFixa: "", tracos: [], caminhoReferencia: "" });
const novoCapitulo = () => ({ titulo: "", resumo: "" });

async function acompanhar(id: number) {
  tarefaId.value = id;
  const final = await aguardar(id);
  if (final.status === "concluida") proposta.value = final.resultado as Planejamento;
  else if (final.status === "falhou") erro.value = final.erro ?? "O planejamento falhou";
}

async function propor() {
  if (!projetoAtual.value) return;
  erro.value = "";
  try {
    const { tarefaId: id } = await chamarApi<{ tarefaId: number }>(`/api/projetos/${projetoAtual.value.id}/planejamento`, {
      metodo: "POST",
      corpo: { enredo: enredo.value },
    });
    await acompanhar(id);
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

async function confirmarPlanejamento() {
  if (!projetoAtual.value || !proposta.value) return;
  erro.value = "";
  try {
    await chamarApi(`/api/projetos/${projetoAtual.value.id}/planejamento/confirmar`, { metodo: "POST", corpo: proposta.value });
    avisar("Planejamento confirmado");
    await roteador.push("/producao");
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

function tracosComoTexto(personagem: Personagem): string {
  return personagem.tracos.join(", ");
}
function definirTracos(personagem: Personagem, texto: string) {
  personagem.tracos = texto.split(",").map((traco) => traco.trim()).filter(Boolean);
}

// Voltou para a tela no meio (ou depois) de uma proposta: retoma a última deste projeto.
onMounted(() => {
  const ultima = tarefas.value.find(
    (t: Tarefa) => t.tipo === "propor_planejamento" && t.projetoId === projetoAtual.value?.id && t.status !== "cancelada",
  );
  if (ultima && ultima.status !== "falhou") void acompanhar(ultima.id);
});
</script>

<template>
  <section class="tela">
    <header class="tela-cabecalho">
      <h1>Planejamento</h1>
      <RouterLink to="/producao" class="botao">Voltar ao quadro</RouterLink>
    </header>

    <p v-if="!projetoAtual" class="vazio">Escolha um projeto no topo da tela.</p>

    <template v-else>
      <form class="painel bloco" @submit.prevent="propor">
        <label class="campo">
          <span>Enredo</span>
          <textarea v-model="enredo" rows="5" placeholder="Conte a história em um ou dois parágrafos: quem, onde, o problema e como termina."></textarea>
        </label>
        <div v-if="gerando && tarefa" class="progresso">
          <span>{{ tarefa.mensagem || "Na fila" }}</span>
          <BarraProgresso :valor="tarefa.progresso" rotulo="Planejamento" />
        </div>
        <button type="submit" class="botao principal" :disabled="gerando">Propor planejamento</button>
      </form>

      <p v-if="erro" class="erro-texto" role="alert">{{ erro }}</p>

      <form v-if="proposta" class="painel bloco" @submit.prevent="confirmarPlanejamento">
        <h2>Revise antes de gravar</h2>
        <label class="campo"><span>Sinopse</span><textarea v-model="proposta.sinopse" rows="3"></textarea></label>
        <label class="campo"><span>Mundo</span><textarea v-model="proposta.mundo" rows="2"></textarea></label>

        <h3>Personagens</h3>
        <EditorLista v-model="proposta.personagens" rotulo-item="Personagem" :novo="novoPersonagem">
          <template #item="{ item }">
            <div class="duas-colunas">
              <label class="campo"><span>Nome</span><input v-model="item.nome" /></label>
              <label class="campo"><span>Papel</span><input v-model="item.papel" /></label>
            </div>
            <label class="campo">
              <span>Aparência fixa</span>
              <textarea v-model="item.aparenciaFixa" rows="2"></textarea>
              <small>Vai em todo pedido de imagem, para o personagem não mudar de cara.</small>
            </label>
            <label class="campo">
              <span>Traços (separados por vírgula)</span>
              <input :value="tracosComoTexto(item)" @change="definirTracos(item, ($event.target as HTMLInputElement).value)" />
            </label>
          </template>
        </EditorLista>

        <h3>Capítulos</h3>
        <EditorLista v-model="proposta.esbocos" rotulo-item="Capítulo" :novo="novoCapitulo">
          <template #item="{ item }">
            <label class="campo"><span>Título</span><input v-model="item.titulo" /></label>
            <label class="campo"><span>Resumo</span><textarea v-model="item.resumo" rows="2"></textarea></label>
          </template>
        </EditorLista>

        <button type="submit" class="botao principal">Confirmar planejamento</button>
      </form>
    </template>
  </section>
</template>

<style scoped>
.bloco { display: grid; gap: 14px; max-width: 860px; }
.bloco > .botao.principal { justify-self: start; }
.progresso { display: grid; gap: 6px; color: var(--texto-suave); }
.duas-colunas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
small { color: var(--texto-suave); }
</style>
