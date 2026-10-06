<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { chamarApi } from "../api/cliente";
import { aoEvento } from "../api/eventos";
import type { Atualizacao, Capitulo, ResumoVersao, Tarefa, VersaoRoteiro } from "../api/tipos";
import { ArrowLeft, Check, RefreshCw, ShieldCheck, Sparkles, TriangleAlert } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import BarraProgresso from "../componentes/BarraProgresso.vue";
import CabecalhoTela from "../componentes/CabecalhoTela.vue";
import Campo from "../componentes/Campo.vue";
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

async function escolherVersao(versao: unknown) {
  versaoEscolhida.value = Number(versao);
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
  <section class="mx-auto grid max-w-6xl gap-6">
    <CabecalhoTela :titulo="`Cap. ${numero} · ${capitulo?.titulo ?? ''}`">
      <Badge v-if="capitulo?.status === 'aprovado'">Roteiro aprovado</Badge>
      <Badge v-else-if="capitulo?.status === 'roteiro_gerado'" variant="outline">Aguardando aprovação</Badge>
      <Button as-child variant="outline"><RouterLink to="/producao"><ArrowLeft /> Voltar ao quadro</RouterLink></Button>
    </CabecalhoTela>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="grid gap-4">
        <Card v-if="ativa">
          <CardContent class="grid gap-2 text-sm text-muted-foreground">
            <span>{{ ativa.status === "na_fila" ? "Na fila" : ativa.mensagem || "Executando" }}</span>
            <BarraProgresso :valor="ativa.progresso" :rotulo="`Capítulo ${numero}`" />
          </CardContent>
        </Card>

        <template v-if="roteiro">
          <div class="grid gap-2">
            <Label>Versão</Label>
            <Select :model-value="versaoEscolhida ?? undefined" @update:model-value="escolherVersao">
              <SelectTrigger aria-label="Versão" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="versao in versoes" :key="versao.versao" :value="versao.versao">{{ rotuloVersao(versao) }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Alert v-if="resumoAtual?.contexto?.possivelCorte" variant="destructive">
            <TriangleAlert />
            <AlertDescription>
              Possível corte de contexto nesta versão: o pedido ficou colado no limite. Aumente o contexto de trabalho em Configurações e gere de novo.
            </AlertDescription>
          </Alert>
          <Alert v-if="resumoAtual?.contexto?.percentualCpu">
            <TriangleAlert />
            <AlertDescription>
              {{ resumoAtual.modelo }}: {{ resumoAtual.contexto.percentualCpu }}% na CPU (mais lento). Reduza o contexto ou use um modelo menor.
            </AlertDescription>
          </Alert>
          <ol class="grid gap-3" aria-label="Cenas">
            <li v-for="(cena, indice) in roteiro.roteiro.cenas" :key="indice">
              <Card>
                <CardHeader><CardTitle><h3>Cena {{ indice + 1 }}</h3></CardTitle></CardHeader>
                <CardContent class="grid gap-3">
                  <p>{{ cena.narracao }}</p>
                  <dl class="grid gap-1 text-sm">
                    <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted-foreground">Personagens</dt><dd>{{ cena.personagensPresentes.join(", ") }}</dd></div>
                    <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted-foreground">Imagem</dt><dd>{{ cena.descricaoVisual }}</dd></div>
                  </dl>
                </CardContent>
              </Card>
            </li>
          </ol>
        </template>
        <p v-else class="rounded-xl border p-6 text-muted-foreground">Este capítulo ainda não tem roteiro.</p>
      </div>

      <aside class="grid gap-4 lg:sticky lg:top-0">
        <Card>
          <CardContent class="grid gap-3">
            <p v-if="roteiro && capitulo" class="tabular-nums">
              Duração estimada: {{ roteiro.minutosEstimados.toLocaleString("pt-BR") }} min de {{ capitulo.duracaoAlvoMinutos }} min
            </p>
            <p v-if="resumoAtual?.contexto" class="tabular-nums" :class="usoContexto > 0.8 ? 'text-destructive' : ''">
              {{ textoContexto(resumoAtual.contexto.tokensPrompt, resumoAtual.contexto.numCtx) }}
            </p>
            <SeletorModelo v-model="modeloGeracao" :permitir-padrao="true" rotulo-padrao="Modelo do projeto" rotulo="Gerar com" />
            <Button v-if="!roteiro" type="button" :disabled="!!ativa" @click="gerar"><Sparkles /> Gerar roteiro</Button>
          </CardContent>
        </Card>

        <Card v-if="roteiro">
          <CardContent>
            <form class="grid gap-3" @submit.prevent="refazer">
              <Campo rotulo="O que corrigir">
                <Textarea v-model="instrucao" rows="3" placeholder="Ex.: o Pedro não pode morrer aqui; retome a cena do rio" />
              </Campo>
              <Button type="submit" variant="outline" :disabled="!!ativa || !instrucao.trim()"><RefreshCw /> Refazer com esta instrução</Button>
            </form>
          </CardContent>
        </Card>

        <Card v-if="roteiro">
          <CardContent class="grid gap-3">
            <Button type="button" variant="outline" :disabled="!!ativa" @click="verificarContinuidade"><ShieldCheck /> Verificar continuidade</Button>
            <Badge v-if="problemas && !problemas.length" class="justify-self-start">Nenhum problema encontrado</Badge>
            <ul v-if="problemas?.length" class="grid gap-2 text-sm">
              <li v-for="(problema, indice) in problemas" :key="indice" class="grid">
                <strong>{{ problema.descricao }}</strong>
                <small class="text-muted-foreground">Sugestão: {{ problema.sugestao }}</small>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card v-if="roteiro && capitulo?.status !== 'aprovado'">
          <CardContent class="grid gap-3">
            <Button v-if="!proposta" type="button" :disabled="!!ativa" @click="proporAprovacao"><Check /> Aprovar roteiro</Button>
            <form v-else class="grid gap-4" @submit.prevent="confirmarAprovacao">
              <h3 class="font-semibold">O que vira oficial no dossiê</h3>
              <Campo rotulo="Resumo do capítulo"><Textarea v-model="proposta.resumoCapitulo" rows="3" /></Campo>
              <fieldset v-if="proposta.novosFatos.length" class="grid gap-2">
                <legend class="mb-1 text-sm font-medium">Fatos novos</legend>
                <Label v-for="fato in proposta.novosFatos" :key="fato" class="items-start font-normal">
                  <Checkbox :model-value="escolhidos.fatos.has(fato)" @update:model-value="alternar(escolhidos.fatos, fato)" />
                  {{ fato }}
                </Label>
              </fieldset>
              <fieldset v-if="proposta.novosPersonagens.length" class="grid gap-2">
                <legend class="mb-1 text-sm font-medium">Personagens novos</legend>
                <Label v-for="personagem in proposta.novosPersonagens" :key="personagem.nome" class="items-start font-normal">
                  <Checkbox :model-value="escolhidos.personagens.has(personagem.nome)" @update:model-value="alternar(escolhidos.personagens, personagem.nome)" />
                  {{ personagem.nome }}: {{ personagem.aparenciaFixa }}
                </Label>
              </fieldset>
              <fieldset v-if="proposta.fiosAbertos.length" class="grid gap-2">
                <legend class="mb-1 text-sm font-medium">Fios abertos novos</legend>
                <Label v-for="fio in proposta.fiosAbertos" :key="fio" class="items-start font-normal">
                  <Checkbox :model-value="escolhidos.abertos.has(fio)" @update:model-value="alternar(escolhidos.abertos, fio)" />
                  {{ fio }}
                </Label>
              </fieldset>
              <fieldset v-if="proposta.fiosResolvidos.length" class="grid gap-2">
                <legend class="mb-1 text-sm font-medium">Fios resolvidos</legend>
                <Label v-for="fio in proposta.fiosResolvidos" :key="fio" class="items-start font-normal">
                  <Checkbox :model-value="escolhidos.resolvidos.has(fio)" @update:model-value="alternar(escolhidos.resolvidos, fio)" />
                  {{ fio }}
                </Label>
              </fieldset>
              <div class="flex gap-2">
                <Button type="button" variant="outline" @click="proposta = null">Voltar</Button>
                <Button type="submit">Confirmar aprovação</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </aside>
    </div>
  </section>
</template>
