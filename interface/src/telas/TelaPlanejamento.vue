<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { chamarApi } from "../api/cliente";
import type { Personagem, Planejamento, Tarefa } from "../api/tipos";
import { ArrowLeft, Sparkles } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Campo from "../componentes/Campo.vue";
import CabecalhoTela from "../componentes/CabecalhoTela.vue";
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
  <section class="mx-auto grid max-w-3xl gap-6">
    <CabecalhoTela titulo="Planejamento">
      <Button as-child variant="outline"><RouterLink to="/producao"><ArrowLeft /> Voltar ao quadro</RouterLink></Button>
    </CabecalhoTela>

    <p v-if="!projetoAtual" class="text-muted-foreground">Escolha um projeto no topo da tela.</p>

    <template v-else>
      <Card>
        <CardContent>
          <form class="grid gap-4" @submit.prevent="propor">
            <Campo rotulo="Enredo">
              <Textarea v-model="enredo" rows="5" placeholder="Conte a história em um ou dois parágrafos: quem, onde, o problema e como termina." />
            </Campo>
            <div v-if="gerando && tarefa" class="grid gap-2 text-sm text-muted-foreground">
              <span>{{ tarefa.mensagem || "Na fila" }}</span>
              <BarraProgresso :valor="tarefa.progresso" rotulo="Planejamento" />
            </div>
            <Button type="submit" class="justify-self-start" :disabled="gerando"><Sparkles /> Propor planejamento</Button>
          </form>
        </CardContent>
      </Card>

      <Alert v-if="erro" variant="destructive"><AlertDescription>{{ erro }}</AlertDescription></Alert>

      <Card v-if="proposta">
        <CardHeader><CardTitle><h2>Revise antes de gravar</h2></CardTitle></CardHeader>
        <CardContent>
          <form class="grid gap-5" @submit.prevent="confirmarPlanejamento">
            <Campo rotulo="Sinopse"><Textarea v-model="proposta.sinopse" rows="3" /></Campo>
            <Campo rotulo="Mundo"><Textarea v-model="proposta.mundo" rows="2" /></Campo>

            <h3 class="font-semibold">Personagens</h3>
            <EditorLista v-model="proposta.personagens" rotulo-item="Personagem" :novo="novoPersonagem">
              <template #item="{ item }">
                <div class="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Nome"><Input v-model="item.nome" /></Campo>
                  <Campo rotulo="Papel"><Input v-model="item.papel" /></Campo>
                </div>
                <Campo rotulo="Aparência fixa">
                  <Textarea v-model="item.aparenciaFixa" rows="2" />
                  <template #dica>Vai em todo pedido de imagem, para o personagem não mudar de cara.</template>
                </Campo>
                <Campo rotulo="Traços (separados por vírgula)">
                  <Input :model-value="tracosComoTexto(item)" @change="definirTracos(item, ($event.target as HTMLInputElement).value)" />
                </Campo>
              </template>
            </EditorLista>

            <h3 class="font-semibold">Capítulos</h3>
            <EditorLista v-model="proposta.esbocos" rotulo-item="Capítulo" :novo="novoCapitulo">
              <template #item="{ item }">
                <Campo rotulo="Título"><Input v-model="item.titulo" /></Campo>
                <Campo rotulo="Resumo"><Textarea v-model="item.resumo" rows="2" /></Campo>
              </template>
            </EditorLista>

            <Button type="submit" class="justify-self-start">Confirmar planejamento</Button>
          </form>
        </CardContent>
      </Card>
    </template>
  </section>
</template>
