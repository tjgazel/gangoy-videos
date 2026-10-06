<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { chamarApi } from "../api/cliente";
import { aoEvento } from "../api/eventos";
import type { Atualizacao, Capitulo, ResumoVersao, Tarefa, VersaoRoteiro } from "../api/tipos";
import BarraProgresso from "../componentes/BarraProgresso.vue";
import SeletorModelo from "../componentes/SeletorModelo.vue";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";
import { usarTarefas } from "../estado/usarTarefas";
import { avisar } from "../estado/usarAvisos";

interface Problema {
  tipo: string;
  descricao: string;
  sugestao: string;
}

const rota = useRoute();
const numero = computed(() => Number(rota.params.numero));
const { projetoAtual } = usarProjetoAtual();
const { tarefas, ativaDoCapitulo, aguardar } = usarTarefas();

const capitulo = ref<Capitulo | null>(null);
const versoes = ref<ResumoVersao[]>([]);
const versaoEscolhida = ref<number | null>(null);
const roteiro = ref<VersaoRoteiro | null>(null);
const modeloGeracao = ref("");
const instrucao = ref("");
const problemas = ref<Problema[] | null>(null);
const proposta = ref<Atualizacao | null>(null);
const escolhidos = ref({ fatos: new Set<string>(), personagens: new Set<string>(), abertos: new Set<string>(), resolvidos: new Set<string>() });

const base = computed(() => (projetoAtual.value ? `/api/projetos/${projetoAtual.value.id}/capitulos/${numero.value}` : null));
const ativa = computed(() => (projetoAtual.value ? ativaDoCapitulo(projetoAtual.value.id, numero.value) : null));
const resumoAtual = computed(() => versoes.value.find((v) => v.versao === versaoEscolhida.value) ?? null);
const usoContexto = computed(() => {
  const contexto = resumoAtual.value?.contexto;
  return contexto ? contexto.tokensPrompt / contexto.numCtx : 0;
});

function rotuloVersao(versao: ResumoVersao): string {
  const partes = [`v${versao.versao}`];
  if (versao.modelo) partes.push(versao.modelo);
  if (versao.duracaoGeracaoSegundos !== null) partes.push(`${versao.duracaoGeracaoSegundos.toLocaleString("pt-BR")} s`);
  if (versao.contexto) partes.push(textoContexto(versao.contexto.tokensPrompt, versao.contexto.numCtx));
  if (versao.instrucao) partes.push(`"${versao.instrucao}"`);
  return partes.join(" · ");
}

// "Contexto: 30% (9.800 de 32.768)": números exatos, para não parecer estourado sem estar.
function textoContexto(tokens: number, numCtx: number): string {
  const percentual = Math.round((tokens / numCtx) * 100);
  return `Contexto: ${percentual}% (${tokens.toLocaleString("pt-BR")} de ${numCtx.toLocaleString("pt-BR")})`;
}

async function carregar(escolher?: number) {
  if (!base.value || !projetoAtual.value) return;
  const lista = await chamarApi<Capitulo[]>(`/api/projetos/${projetoAtual.value.id}/capitulos`);
  capitulo.value = lista.find((c) => c.numero === numero.value) ?? null;
  versoes.value = await chamarApi<ResumoVersao[]>(`${base.value}/versoes`).catch(() => []);
  const alvo = escolher ?? versoes.value.at(-1)?.versao ?? null;
  versaoEscolhida.value = alvo;
  roteiro.value = alvo ? await chamarApi<VersaoRoteiro>(`${base.value}/versoes/${alvo}`) : null;
  retomarProposta();
}

async function escolherVersao() {
  if (base.value && versaoEscolhida.value) {
    roteiro.value = await chamarApi<VersaoRoteiro>(`${base.value}/versoes/${versaoEscolhida.value}`);
  }
}

async function executar(caminho: string, corpo?: unknown): Promise<Tarefa | null> {
  if (!base.value) return null;
  try {
    const { tarefaId } = await chamarApi<{ tarefaId: number }>(`${base.value}/${caminho}`, { metodo: "POST", corpo });
    return await aguardar(tarefaId);
  } catch (falha) {
    avisar((falha as Error).message, "erro");
    return null;
  }
}

async function gerar() {
  const final = await executar("roteiro", { modelo: modeloGeracao.value || undefined });
  if (final?.status === "concluida") await carregar();
}

async function refazer() {
  const final = await executar("refazer", { instrucao: instrucao.value, modelo: modeloGeracao.value || undefined });
  if (final?.status === "concluida") {
    instrucao.value = "";
    await carregar();
  }
}

async function verificarContinuidade() {
  problemas.value = null;
  const final = await executar("continuidade", { modelo: modeloGeracao.value || undefined });
  if (final?.status === "concluida") problemas.value = (final.resultado as { problemas: Problema[] }).problemas;
}

function usarProposta(atualizacao: Atualizacao) {
  proposta.value = atualizacao;
  escolhidos.value = {
    fatos: new Set(atualizacao.novosFatos),
    personagens: new Set(atualizacao.novosPersonagens.map((p) => p.nome)),
    abertos: new Set(atualizacao.fiosAbertos),
    resolvidos: new Set(atualizacao.fiosResolvidos),
  };
}

async function proporAprovacao() {
  const final = await executar("proposta-dossie");
  if (final?.status === "concluida") usarProposta(final.resultado as Atualizacao);
}

// Proposta já pronta (ex.: aberta pela tela Revisão): mostra sem gerar de novo.
function retomarProposta() {
  if (proposta.value || capitulo.value?.status === "aprovado" || !projetoAtual.value) return;
  const pronta = tarefas.value.find(
    (t) => t.tipo === "propor_atualizacao_dossie" && t.projetoId === projetoAtual.value?.id && t.capituloNumero === numero.value,
  );
  if (pronta?.status === "concluida") usarProposta(pronta.resultado as Atualizacao);
}

function alternar(conjunto: Set<string>, valor: string) {
  if (conjunto.has(valor)) conjunto.delete(valor);
  else conjunto.add(valor);
}

async function confirmarAprovacao() {
  if (!base.value || !proposta.value) return;
  const atual = proposta.value;
  const corpo: Atualizacao = {
    resumoCapitulo: atual.resumoCapitulo,
    novosFatos: atual.novosFatos.filter((f) => escolhidos.value.fatos.has(f)),
    novosPersonagens: atual.novosPersonagens.filter((p) => escolhidos.value.personagens.has(p.nome)),
    fiosAbertos: atual.fiosAbertos.filter((f) => escolhidos.value.abertos.has(f)),
    fiosResolvidos: atual.fiosResolvidos.filter((f) => escolhidos.value.resolvidos.has(f)),
  };
  try {
    await chamarApi(`${base.value}/aprovar`, { metodo: "POST", corpo });
    proposta.value = null;
    avisar("Roteiro aprovado e dossiê atualizado");
    await carregar(versaoEscolhida.value ?? undefined);
  } catch (falha) {
    avisar((falha as Error).message, "erro");
  }
}

const cancelar = aoEvento("tarefa", (tarefa) => {
  if (tarefa.projetoId === projetoAtual.value?.id && tarefa.capituloNumero === numero.value && tarefa.status === "concluida") {
    if (tarefa.tipo === "gerar_roteiro" || tarefa.tipo === "refazer_roteiro") void carregar();
  }
});
onUnmounted(cancelar);
watch([() => projetoAtual.value?.id, numero], () => void carregar(), { immediate: true });
</script>

<template>
  <section class="tela">
    <header class="tela-cabecalho">
      <h1>Cap. {{ numero }} · {{ capitulo?.titulo ?? "" }}</h1>
      <span v-if="capitulo?.status === 'aprovado'" class="etiqueta sucesso">Roteiro aprovado</span>
      <span v-else-if="capitulo?.status === 'roteiro_gerado'" class="etiqueta alerta">Aguardando aprovação</span>
      <RouterLink to="/producao" class="botao">Voltar ao quadro</RouterLink>
    </header>

    <div class="layout">
      <div class="principal">
        <div v-if="ativa" class="painel progresso">
          <span>{{ ativa.status === "na_fila" ? "Na fila" : ativa.mensagem || "Executando" }}</span>
          <BarraProgresso :valor="ativa.progresso" :rotulo="`Capítulo ${numero}`" />
        </div>

        <template v-if="roteiro">
          <label class="campo">
            <span>Versão</span>
            <select v-model.number="versaoEscolhida" aria-label="Versão" @change="escolherVersao">
              <option v-for="versao in versoes" :key="versao.versao" :value="versao.versao">{{ rotuloVersao(versao) }}</option>
            </select>
          </label>
          <p v-if="resumoAtual?.contexto?.possivelCorte" class="etiqueta erro alerta-corte">
            Possível corte de contexto nesta versão: o pedido ficou colado no limite. Aumente o contexto de trabalho em Configurações e gere de novo.
          </p>
          <p v-if="resumoAtual?.contexto?.percentualCpu" class="etiqueta alerta alerta-corte">
            {{ resumoAtual.modelo }}: {{ resumoAtual.contexto.percentualCpu }}% na CPU (mais lento). Reduza o contexto ou use um modelo menor.
          </p>
          <ol class="cenas" aria-label="Cenas">
            <li v-for="(cena, indice) in roteiro.roteiro.cenas" :key="indice" class="cena">
              <h3>Cena {{ indice + 1 }}</h3>
              <p>{{ cena.narracao }}</p>
              <dl>
                <div><dt>Personagens</dt><dd>{{ cena.personagensPresentes.join(", ") }}</dd></div>
                <div><dt>Imagem</dt><dd>{{ cena.descricaoVisual }}</dd></div>
              </dl>
            </li>
          </ol>
        </template>
        <div v-else class="painel vazio-roteiro">
          <p class="vazio">Este capítulo ainda não tem roteiro.</p>
        </div>
      </div>

      <aside class="lateral">
        <div class="painel bloco">
          <p v-if="roteiro && capitulo" class="numeros">
            Duração estimada: {{ roteiro.minutosEstimados.toLocaleString("pt-BR") }} min de {{ capitulo.duracaoAlvoMinutos }} min
          </p>
          <p v-if="resumoAtual?.contexto" class="numeros" :class="{ atencao: usoContexto > 0.8 }">
            {{ textoContexto(resumoAtual.contexto.tokensPrompt, resumoAtual.contexto.numCtx) }}
          </p>
          <SeletorModelo v-model="modeloGeracao" :permitir-padrao="true" rotulo-padrao="Modelo do projeto" rotulo="Gerar com" />
          <button v-if="!roteiro" type="button" class="botao principal" :disabled="!!ativa" @click="gerar">Gerar roteiro</button>
        </div>

        <form v-if="roteiro" class="painel bloco" @submit.prevent="refazer">
          <label class="campo">
            <span>O que corrigir</span>
            <textarea v-model="instrucao" rows="3" placeholder="Ex.: o Pedro não pode morrer aqui; retome a cena do rio"></textarea>
          </label>
          <button type="submit" class="botao" :disabled="!!ativa || !instrucao.trim()">Refazer com esta instrução</button>
        </form>

        <div v-if="roteiro" class="painel bloco">
          <button type="button" class="botao" :disabled="!!ativa" @click="verificarContinuidade">Verificar continuidade</button>
          <p v-if="problemas && !problemas.length" class="etiqueta sucesso">Nenhum problema encontrado</p>
          <ul v-if="problemas?.length" class="problemas">
            <li v-for="(problema, indice) in problemas" :key="indice">
              <strong>{{ problema.descricao }}</strong>
              <small>Sugestão: {{ problema.sugestao }}</small>
            </li>
          </ul>
        </div>

        <div v-if="roteiro && capitulo?.status !== 'aprovado'" class="painel bloco">
          <button v-if="!proposta" type="button" class="botao principal" :disabled="!!ativa" @click="proporAprovacao">Aprovar roteiro</button>
          <form v-else class="bloco" @submit.prevent="confirmarAprovacao">
            <h3>O que vira oficial no dossiê</h3>
            <label class="campo"><span>Resumo do capítulo</span><textarea v-model="proposta.resumoCapitulo" rows="3"></textarea></label>
            <fieldset v-if="proposta.novosFatos.length">
              <legend>Fatos novos</legend>
              <label v-for="fato in proposta.novosFatos" :key="fato" class="marcar">
                <input type="checkbox" :checked="escolhidos.fatos.has(fato)" @change="alternar(escolhidos.fatos, fato)" />{{ fato }}
              </label>
            </fieldset>
            <fieldset v-if="proposta.novosPersonagens.length">
              <legend>Personagens novos</legend>
              <label v-for="personagem in proposta.novosPersonagens" :key="personagem.nome" class="marcar">
                <input type="checkbox" :checked="escolhidos.personagens.has(personagem.nome)" @change="alternar(escolhidos.personagens, personagem.nome)" />
                {{ personagem.nome }}: {{ personagem.aparenciaFixa }}
              </label>
            </fieldset>
            <fieldset v-if="proposta.fiosAbertos.length">
              <legend>Fios abertos novos</legend>
              <label v-for="fio in proposta.fiosAbertos" :key="fio" class="marcar">
                <input type="checkbox" :checked="escolhidos.abertos.has(fio)" @change="alternar(escolhidos.abertos, fio)" />{{ fio }}
              </label>
            </fieldset>
            <fieldset v-if="proposta.fiosResolvidos.length">
              <legend>Fios resolvidos</legend>
              <label v-for="fio in proposta.fiosResolvidos" :key="fio" class="marcar">
                <input type="checkbox" :checked="escolhidos.resolvidos.has(fio)" @change="alternar(escolhidos.resolvidos, fio)" />{{ fio }}
              </label>
            </fieldset>
            <div class="acoes">
              <button type="button" class="botao" @click="proposta = null">Voltar</button>
              <button type="submit" class="botao principal">Confirmar aprovação</button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
.principal { display: grid; gap: 14px; }
.lateral { display: grid; gap: 12px; position: sticky; top: 70px; }
.bloco { display: grid; gap: 10px; }
.bloco p { margin: 0; }
.progresso { display: grid; gap: 6px; color: var(--texto-suave); }
.atencao { color: var(--alerta); }
.alerta-corte { display: block; border-radius: 8px; padding: 8px 12px; }
.cenas { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.cena {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  background: var(--cartao);
  border: 1px solid var(--cartao-borda);
  border-left: 3px solid var(--destaque);
  border-radius: 8px;
}
.cena h3 { color: var(--texto-suave); font-size: 12px; font-weight: 600; }
.cena p { margin: 0; max-width: 75ch; }
.cena dl { margin: 0; display: grid; gap: 2px; font-size: 13px; }
.cena dl div { display: flex; gap: 8px; }
.cena dt { color: var(--texto-suave); min-width: 86px; }
.cena dd { margin: 0; }
.problemas { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.problemas small { display: block; color: var(--texto-suave); }
fieldset { border: 1px solid var(--cartao-borda); border-radius: 8px; padding: 8px 10px; display: grid; gap: 6px; margin: 0; }
legend { color: var(--texto-suave); font-size: 13px; }
.marcar { display: flex; gap: 8px; align-items: flex-start; }
.marcar input { width: auto; margin-top: 4px; }
.acoes { display: flex; gap: 8px; justify-content: flex-end; }
@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .lateral { position: static; }
}
</style>
