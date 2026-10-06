<script setup lang="ts">
import { ref, watch } from "vue";
import { chamarApi } from "../api/cliente";
import type { Dossie, Personagem } from "../api/tipos";
import { Braces, ListTree, Save } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Campo from "../componentes/Campo.vue";
import CabecalhoTela from "../componentes/CabecalhoTela.vue";
import EditorLista from "../componentes/EditorLista.vue";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";
import { avisar } from "../estado/usarAvisos";

const { projetoAtual } = usarProjetoAtual();
const dossie = ref<Dossie | null>(null);
const semDossie = ref(false);
const erro = ref("");
const modoJson = ref(false);
const textoJson = ref("");

const novoPersonagem = (): Personagem => ({ nome: "", papel: "", aparenciaFixa: "", tracos: [], caminhoReferencia: "" });

async function carregar() {
  erro.value = "";
  semDossie.value = false;
  dossie.value = null;
  if (!projetoAtual.value) return;
  try {
    dossie.value = await chamarApi<Dossie>(`/api/projetos/${projetoAtual.value.id}/dossie`);
  } catch {
    semDossie.value = true;
  }
}

async function salvar(conteudo: unknown) {
  if (!projetoAtual.value) return;
  erro.value = "";
  try {
    dossie.value = await chamarApi<Dossie>(`/api/projetos/${projetoAtual.value.id}/dossie`, { metodo: "PUT", corpo: conteudo });
    modoJson.value = false;
    avisar("Dossiê salvo");
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

function abrirJson() {
  textoJson.value = JSON.stringify(dossie.value, null, 2);
  modoJson.value = true;
}

function salvarJson() {
  try {
    void salvar(JSON.parse(textoJson.value));
  } catch {
    erro.value = "O texto não é JSON válido. Confira vírgulas, aspas e chaves.";
  }
}

// O Input do shadcn-vue entrega texto; os campos de capítulo são números no dossiê.
const numero = (valor: string | number): number => Number(valor);

function tracosComoTexto(personagem: Personagem): string {
  return personagem.tracos.join(", ");
}
function definirTracos(personagem: Personagem, texto: string) {
  personagem.tracos = texto.split(",").map((traco) => traco.trim()).filter(Boolean);
}

watch(() => projetoAtual.value?.id, carregar, { immediate: true });
</script>
<template>
  <section class="mx-auto grid max-w-4xl gap-6">
    <CabecalhoTela titulo="Dossiê">
      <template v-if="dossie">
        <Button v-if="!modoJson" type="button" variant="outline" @click="abrirJson"><Braces /> Ver JSON</Button>
        <Button v-else type="button" variant="outline" @click="modoJson = false"><ListTree /> Voltar às seções</Button>
      </template>
    </CabecalhoTela>
    <p class="max-w-prose text-muted-foreground">Tudo o que já foi decidido sobre a história. Vai inteiro para o modelo a cada capítulo, para a história não se contradizer.</p>

    <p v-if="!projetoAtual" class="text-muted-foreground">Escolha um projeto no topo da tela.</p>
    <p v-else-if="semDossie" class="text-muted-foreground">Este projeto ainda não tem dossiê. Faça o planejamento na tela Produção.</p>
    <Alert v-if="erro" variant="destructive"><AlertDescription>{{ erro }}</AlertDescription></Alert>

    <Card v-if="dossie && modoJson">
      <CardContent>
        <form class="grid gap-4" @submit.prevent="salvarJson">
          <Campo rotulo="Dossiê em JSON">
            <Textarea v-model="textoJson" rows="24" spellcheck="false" class="font-mono text-xs" />
          </Campo>
          <Button type="submit" class="justify-self-start"><Save /> Salvar JSON</Button>
        </form>
      </CardContent>
    </Card>

    <form v-else-if="dossie" class="grid gap-4" @submit.prevent="salvar(dossie)">
      <Card>
        <CardHeader><CardTitle><h2>Sinopse</h2></CardTitle></CardHeader>
        <CardContent>
          <Textarea v-model="dossie.sinopse" rows="3" aria-label="Sinopse" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Mundo</h2></CardTitle></CardHeader>
        <CardContent>
          <Textarea v-model="dossie.mundo" rows="3" aria-label="Mundo" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Personagens</h2></CardTitle></CardHeader>
        <CardContent>
          <EditorLista v-model="dossie.personagens" rotulo-item="Personagem" :novo="novoPersonagem">
            <template #item="{ item }">
              <div class="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Nome"><Input v-model="item.nome" /></Campo>
                <Campo rotulo="Papel"><Input v-model="item.papel" /></Campo>
              </div>
              <Campo rotulo="Aparência fixa"><Textarea v-model="item.aparenciaFixa" rows="2" /></Campo>
              <Campo rotulo="Traços (separados por vírgula)">
                <Input :model-value="tracosComoTexto(item)" @change="definirTracos(item, ($event.target as HTMLInputElement).value)" />
              </Campo>
            </template>
          </EditorLista>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Fatos</h2></CardTitle></CardHeader>
        <CardContent>
          <EditorLista v-model="dossie.fatos" rotulo-item="Fato" :novo="() => ({ capitulo: 1, descricao: '' })">
            <template #item="{ item }">
              <div class="grid gap-3 sm:grid-cols-[7rem_1fr]">
                <Campo rotulo="Capítulo"><Input type="number" min="1" :model-value="item.capitulo" @update:model-value="item.capitulo = numero($event)" /></Campo>
                <Campo rotulo="O que aconteceu"><Input v-model="item.descricao" /></Campo>
              </div>
            </template>
          </EditorLista>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Fios abertos</h2></CardTitle></CardHeader>
        <CardContent>
          <EditorLista v-model="dossie.fiosAbertos" rotulo-item="Fio" :novo="() => ''">
            <template #item="{ indice }">
              <Campo rotulo="Ponta solta a resolver"><Input v-model="dossie.fiosAbertos[indice]" /></Campo>
            </template>
          </EditorLista>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Linha do tempo</h2></CardTitle></CardHeader>
        <CardContent>
          <EditorLista v-model="dossie.linhaDoTempo" rotulo-item="Evento" :novo="() => ({ capitulo: 1, evento: '' })">
            <template #item="{ item }">
              <div class="grid gap-3 sm:grid-cols-[7rem_1fr]">
                <Campo rotulo="Capítulo"><Input type="number" min="1" :model-value="item.capitulo" @update:model-value="item.capitulo = numero($event)" /></Campo>
                <Campo rotulo="Evento"><Input v-model="item.evento" /></Campo>
              </div>
            </template>
          </EditorLista>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Esboços</h2></CardTitle></CardHeader>
        <CardContent>
          <EditorLista v-model="dossie.esbocosCapitulos" rotulo-item="Esboço" :novo="() => ({ numero: dossie!.esbocosCapitulos.length + 1, titulo: '', resumo: '' })">
            <template #item="{ item }">
              <div class="grid gap-3 sm:grid-cols-[7rem_1fr]">
                <Campo rotulo="Capítulo"><Input type="number" min="1" :model-value="item.numero" @update:model-value="item.numero = numero($event)" /></Campo>
                <Campo rotulo="Título"><Input v-model="item.titulo" /></Campo>
              </div>
              <Campo rotulo="Resumo"><Textarea v-model="item.resumo" rows="2" /></Campo>
            </template>
          </EditorLista>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h2>Resumos</h2></CardTitle></CardHeader>
        <CardContent>
          <EditorLista v-model="dossie.resumosCapitulos" rotulo-item="Resumo" :novo="() => ({ numero: 1, resumo: '' })">
            <template #item="{ item }">
              <div class="grid gap-3 sm:grid-cols-[7rem_1fr]">
                <Campo rotulo="Capítulo"><Input type="number" min="1" :model-value="item.numero" @update:model-value="item.numero = numero($event)" /></Campo>
                <Campo rotulo="Resumo aprovado"><Textarea v-model="item.resumo" rows="2" /></Campo>
              </div>
            </template>
          </EditorLista>
        </CardContent>
      </Card>
      <div class="sticky bottom-0 -mx-4 border-t bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Button type="submit"><Save /> Salvar dossiê</Button>
      </div>
    </form>
  </section>
</template>
