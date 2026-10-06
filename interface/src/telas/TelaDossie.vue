<script setup lang="ts">
import { ref, watch } from "vue";
import { chamarApi } from "../api/cliente";
import type { Dossie, Personagem } from "../api/tipos";
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

function tracosComoTexto(personagem: Personagem): string {
  return personagem.tracos.join(", ");
}
function definirTracos(personagem: Personagem, texto: string) {
  personagem.tracos = texto.split(",").map((traco) => traco.trim()).filter(Boolean);
}

watch(() => projetoAtual.value?.id, carregar, { immediate: true });
</script>

<template>
  <section class="tela">
    <header class="tela-cabecalho">
      <h1>Dossiê</h1>
      <template v-if="dossie">
        <button v-if="!modoJson" type="button" class="botao" @click="abrirJson">Ver JSON</button>
        <button v-else type="button" class="botao" @click="modoJson = false">Voltar às seções</button>
      </template>
    </header>
    <p class="ajuda">Tudo o que já foi decidido sobre a história. Vai inteiro para o modelo a cada capítulo, para a história não se contradizer.</p>

    <p v-if="!projetoAtual" class="vazio">Escolha um projeto no topo da tela.</p>
    <p v-else-if="semDossie" class="vazio">Este projeto ainda não tem dossiê. Faça o planejamento na tela Produção.</p>
    <p v-if="erro" class="erro-texto" role="alert">{{ erro }}</p>

    <form v-if="dossie && modoJson" class="painel bloco" @submit.prevent="salvarJson">
      <label class="campo">
        <span>Dossiê em JSON</span>
        <textarea v-model="textoJson" rows="24" spellcheck="false" class="json"></textarea>
      </label>
      <button type="submit" class="botao principal">Salvar JSON</button>
    </form>

    <form v-else-if="dossie" class="secoes" @submit.prevent="salvar(dossie)">
      <section class="painel bloco">
        <h2>Sinopse</h2>
        <textarea v-model="dossie.sinopse" rows="3" aria-label="Sinopse"></textarea>
      </section>
      <section class="painel bloco">
        <h2>Mundo</h2>
        <textarea v-model="dossie.mundo" rows="3" aria-label="Mundo"></textarea>
      </section>
      <section class="painel bloco">
        <h2>Personagens</h2>
        <EditorLista v-model="dossie.personagens" rotulo-item="Personagem" :novo="novoPersonagem">
          <template #item="{ item }">
            <div class="duas-colunas">
              <label class="campo"><span>Nome</span><input v-model="item.nome" /></label>
              <label class="campo"><span>Papel</span><input v-model="item.papel" /></label>
            </div>
            <label class="campo"><span>Aparência fixa</span><textarea v-model="item.aparenciaFixa" rows="2"></textarea></label>
            <label class="campo">
              <span>Traços (separados por vírgula)</span>
              <input :value="tracosComoTexto(item)" @change="definirTracos(item, ($event.target as HTMLInputElement).value)" />
            </label>
          </template>
        </EditorLista>
      </section>
      <section class="painel bloco">
        <h2>Fatos</h2>
        <EditorLista v-model="dossie.fatos" rotulo-item="Fato" :novo="() => ({ capitulo: 1, descricao: '' })">
          <template #item="{ item }">
            <div class="numero-e-texto">
              <label class="campo"><span>Capítulo</span><input v-model.number="item.capitulo" type="number" min="1" /></label>
              <label class="campo"><span>O que aconteceu</span><input v-model="item.descricao" /></label>
            </div>
          </template>
        </EditorLista>
      </section>
      <section class="painel bloco">
        <h2>Fios abertos</h2>
        <EditorLista v-model="dossie.fiosAbertos" rotulo-item="Fio" :novo="() => ''">
          <template #item="{ indice }">
            <label class="campo"><span>Ponta solta a resolver</span><input v-model="dossie.fiosAbertos[indice]" /></label>
          </template>
        </EditorLista>
      </section>
      <section class="painel bloco">
        <h2>Linha do tempo</h2>
        <EditorLista v-model="dossie.linhaDoTempo" rotulo-item="Evento" :novo="() => ({ capitulo: 1, evento: '' })">
          <template #item="{ item }">
            <div class="numero-e-texto">
              <label class="campo"><span>Capítulo</span><input v-model.number="item.capitulo" type="number" min="1" /></label>
              <label class="campo"><span>Evento</span><input v-model="item.evento" /></label>
            </div>
          </template>
        </EditorLista>
      </section>
      <section class="painel bloco">
        <h2>Esboços</h2>
        <EditorLista v-model="dossie.esbocosCapitulos" rotulo-item="Esboço" :novo="() => ({ numero: dossie!.esbocosCapitulos.length + 1, titulo: '', resumo: '' })">
          <template #item="{ item }">
            <div class="numero-e-texto">
              <label class="campo"><span>Capítulo</span><input v-model.number="item.numero" type="number" min="1" /></label>
              <label class="campo"><span>Título</span><input v-model="item.titulo" /></label>
            </div>
            <label class="campo"><span>Resumo</span><textarea v-model="item.resumo" rows="2"></textarea></label>
          </template>
        </EditorLista>
      </section>
      <section class="painel bloco">
        <h2>Resumos</h2>
        <EditorLista v-model="dossie.resumosCapitulos" rotulo-item="Resumo" :novo="() => ({ numero: 1, resumo: '' })">
          <template #item="{ item }">
            <div class="numero-e-texto">
              <label class="campo"><span>Capítulo</span><input v-model.number="item.numero" type="number" min="1" /></label>
              <label class="campo"><span>Resumo aprovado</span><textarea v-model="item.resumo" rows="2"></textarea></label>
            </div>
          </template>
        </EditorLista>
      </section>
      <div class="rodape">
        <button type="submit" class="botao principal">Salvar dossiê</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.ajuda { margin: 0; color: var(--texto-suave); max-width: 72ch; }
.secoes { display: grid; gap: 14px; max-width: 900px; }
.bloco { display: grid; gap: 10px; }
.duas-colunas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.numero-e-texto { display: grid; grid-template-columns: 110px 1fr; gap: 10px; }
.json { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 13px; }
.rodape {
  position: sticky;
  bottom: 0;
  padding: 12px 0;
  background: linear-gradient(transparent, var(--fundo) 40%);
}
.bloco > .botao.principal { justify-self: start; }
</style>
