<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { chamarApi } from "../api/cliente";
import type { ConfiguracoesSistema, ContextoPadraoOllama } from "../api/tipos";
import { Cpu, FolderInput, FolderOpen, Trash2, TriangleAlert, Unplug, MonitorPlay } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CabecalhoTela from "../componentes/CabecalhoTela.vue";
import Campo from "../componentes/Campo.vue";
import SeletorModelo from "../componentes/SeletorModelo.vue";
import NavegadorPastas from "../componentes/NavegadorPastas.vue";
import PainelLateral from "../componentes/PainelLateral.vue";
import BarraProgresso from "../componentes/BarraProgresso.vue";
import { usarStatusSistema } from "../estado/usarStatusSistema";
import { normalizarNomeModelo, usarModelos } from "../estado/usarModelos";
import { usarTarefas } from "../estado/usarTarefas";
import { confirmar } from "../estado/usarConfirmacao";
import { avisar } from "../estado/usarAvisos";
import { formatarBytes, formatarNumero } from "../formatos";

const { status, recarregar: recarregarStatus } = usarStatusSistema();
const { modelos, configuracoes, recarregar: recarregarModelos } = usarModelos();
const { tarefas, aguardar } = usarTarefas();

// ---- Workspace ----
const dadosAntigos = ref<{ nome: string; bytes: number }[]>([]);
const painelMover = ref(false);
const destino = ref<string | null>(null);
const tarefaMover = ref<number | null>(null);
const movendo = computed(() => tarefas.value.find((tarefa) => tarefa.id === tarefaMover.value) ?? null);

async function carregarDadosAntigos() {
  dadosAntigos.value = (await chamarApi<{ itens: { nome: string; bytes: number }[] }>("/api/workspace/dados-antigos")).itens;
}

async function mover() {
  if (!destino.value) return;
  try {
    const { tarefaId } = await chamarApi<{ tarefaId: number }>("/api/workspace/mover", {
      metodo: "POST",
      corpo: { destino: destino.value },
    });
    tarefaMover.value = tarefaId;
    painelMover.value = false;
    const final = await aguardar(tarefaId);
    await recarregarStatus();
    const aviso = (final.resultado as { aviso?: string } | null)?.aviso;
    if (final.status === "concluida") avisar(aviso ?? "Workspace movida", aviso ? "erro" : "sucesso");
  } catch (falha) {
    avisar((falha as Error).message, "erro");
  }
}

async function apagarDadosAntigos() {
  const lista = dadosAntigos.value.map((item) => `${item.nome} (${formatarBytes(item.bytes)})`).join("\n");
  const sim = await confirmar({
    titulo: "Apagar dados antigos já convertidos?",
    texto: `Estes itens de dados/ já foram copiados para a workspace e serão apagados:\n${lista}`,
    botao: "Apagar",
  });
  if (!sim) return;
  try {
    await chamarApi("/api/workspace/dados-antigos", { metodo: "DELETE" });
    avisar("Dados antigos apagados");
    await carregarDadosAntigos();
  } catch (falha) {
    avisar((falha as Error).message, "erro");
  }
}

// ---- Contexto padrão do Ollama (o slider "Context length" do app) ----
const contextoOllama = ref<ContextoPadraoOllama | null>(null);

async function carregarContextoOllama() {
  contextoOllama.value = await chamarApi<ContextoPadraoOllama>("/api/ollama/contexto-padrao");
}

// ---- Modelos ----
const formularioModelos = reactive<ConfiguracoesSistema>({ modeloPrincipal: "", modeloLeve: "", contextoTrabalho: 32768 });
const erroModelos = ref("");
const leveEscolhido = computed(() =>
  modelos.value.find((m) => normalizarNomeModelo(m.nome) === normalizarNomeModelo(formularioModelos.modeloLeve)),
);
// O Ollama reduz em silêncio o contexto ao máximo de cada modelo; o servidor faz o mesmo (min) em cada chamada.
const leveAceitaMenos = computed(() => {
  const maximo = leveEscolhido.value?.contextoMaximo;
  return maximo && Number(formularioModelos.contextoTrabalho) > maximo ? maximo : null;
});
const principalEscolhido = computed(() =>
  modelos.value.find((m) => normalizarNomeModelo(m.nome) === normalizarNomeModelo(formularioModelos.modeloPrincipal)),
);

async function salvarModelos() {
  erroModelos.value = "";
  try {
    const salvo = await chamarApi<ConfiguracoesSistema>("/api/configuracoes", {
      metodo: "PUT",
      corpo: { ...formularioModelos, contextoTrabalho: Number(formularioModelos.contextoTrabalho) },
    });
    Object.assign(formularioModelos, salvo);
    configuracoes.value = salvo;
    avisar("Modelos salvos");
  } catch (falha) {
    erroModelos.value = (falha as Error).message;
  }
}

// ---- YouTube ----
const credenciais = reactive({ clientId: "", clientSecret: "" });
const segredoSalvo = ref(false);
const erroCredenciais = ref("");
const canais = ref<{ idCanal: string; tituloCanal: string; conectadoEm: string }[]>([]);

async function carregarYoutube() {
  const resumo = await chamarApi<{ clientId: string; clientSecretSalvo: boolean }>("/api/configuracoes/youtube");
  credenciais.clientId = resumo.clientId;
  segredoSalvo.value = resumo.clientSecretSalvo;
  canais.value = (await chamarApi<{ contas: typeof canais.value }>("/api/youtube/contas")).contas;
}

async function salvarCredenciais() {
  erroCredenciais.value = "";
  try {
    const resumo = await chamarApi<{ clientSecretSalvo: boolean }>("/api/configuracoes/youtube", {
      metodo: "PUT",
      corpo: { ...credenciais },
    });
    segredoSalvo.value = resumo.clientSecretSalvo;
    credenciais.clientSecret = "";
    avisar("Credenciais salvas");
  } catch (falha) {
    erroCredenciais.value = (falha as Error).message;
  }
}

async function conectar() {
  try {
    const { url } = await chamarApi<{ url: string }>("/api/youtube/oauth/iniciar", { metodo: "POST" });
    window.location.href = url;
  } catch (falha) {
    avisar((falha as Error).message, "erro");
  }
}

async function desconectar(canal: { idCanal: string; tituloCanal: string }) {
  const sim = await confirmar({
    titulo: `Desconectar o canal "${canal.tituloCanal || canal.idCanal}"?`,
    texto: "O acesso também é revogado no Google. Para enviar vídeos a este canal de novo, será preciso conectar outra vez.",
    botao: "Desconectar",
  });
  if (!sim) return;
  try {
    await chamarApi(`/api/youtube/contas/${encodeURIComponent(canal.idCanal)}`, { metodo: "DELETE" });
    await carregarYoutube();
  } catch (falha) {
    avisar((falha as Error).message, "erro");
  }
}

onMounted(async () => {
  await recarregarModelos();
  if (configuracoes.value) Object.assign(formularioModelos, configuracoes.value);
  await Promise.all([carregarDadosAntigos().catch(() => {}), carregarYoutube().catch(() => {}), carregarContextoOllama().catch(() => {})]);
});
</script>
<template>
  <section class="mx-auto grid max-w-3xl gap-6">
    <CabecalhoTela titulo="Configurações" />

    <Card>
      <CardHeader>
        <CardTitle><h2 class="flex items-center gap-2"><FolderOpen class="size-4" /> Workspace</h2></CardTitle>
      </CardHeader>
      <CardContent class="grid gap-4">
        <dl class="grid gap-1.5 text-sm">
          <div class="grid gap-3 sm:grid-cols-[9rem_1fr]"><dt class="text-muted-foreground">Local</dt><dd class="break-all">{{ status?.workspace.caminho ?? "Não configurada" }}</dd></div>
          <div v-if="status?.workspace.espacoLivreBytes !== null && status?.workspace.espacoLivreBytes !== undefined" class="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <dt class="text-muted-foreground">Espaço livre</dt><dd class="tabular-nums">{{ formatarBytes(status.workspace.espacoLivreBytes) }}</dd>
          </div>
        </dl>
        <div v-if="movendo && (movendo.status === 'na_fila' || movendo.status === 'executando')" class="grid gap-2 text-sm text-muted-foreground">
          <span>{{ movendo.mensagem || "Mudança na fila" }}</span>
          <BarraProgresso :valor="movendo.progresso" rotulo="Mudança da workspace" />
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" @click="painelMover = true"><FolderInput /> Mudar local</Button>
          <Button as-child variant="outline"><RouterLink to="/boas-vindas">Apontar outro local</RouterLink></Button>
          <Button v-if="dadosAntigos.length" variant="destructive" @click="apagarDadosAntigos">
            <Trash2 /> Apagar dados antigos já convertidos
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle><h2 class="flex items-center gap-2"><Cpu class="size-4" /> Modelos</h2></CardTitle>
        <CardDescription>Escolha entre os modelos já instalados no Ollama. Para instalar outros, use o próprio Ollama.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="grid gap-4" novalidate @submit.prevent="salvarModelos">
          <SeletorModelo v-model="formularioModelos.modeloPrincipal" :permitir-padrao="false" rotulo="Modelo principal" />
          <SeletorModelo v-model="formularioModelos.modeloLeve" :permitir-padrao="false" rotulo="Modelo leve" />
          <Campo rotulo="Contexto de trabalho (tokens)">
            <Input :model-value="formularioModelos.contextoTrabalho" type="number" step="1024" @update:model-value="formularioModelos.contextoTrabalho = Number($event)" />
            <template v-if="principalEscolhido?.contextoMaximo" #dica>
              O modelo principal aceita até {{ formatarNumero(principalEscolhido.contextoMaximo) }} tokens. Contexto maior usa mais memória da placa de vídeo.
              O app envia este contexto em cada chamada: o “Context length” do Ollama não o limita.
              <template v-if="leveAceitaMenos">
                O modelo leve aceita até {{ formatarNumero(leveAceitaMenos) }} tokens: nas chamadas dele o contexto será {{ formatarNumero(leveAceitaMenos) }}.
              </template>
            </template>
          </Campo>
          <Alert v-if="principalEscolhido?.percentualCpu">
            <TriangleAlert />
            <AlertDescription>
              {{ principalEscolhido.nome }}: {{ principalEscolhido.percentualCpu }}% na CPU (mais lento). Reduza o contexto ou use um modelo menor.
            </AlertDescription>
          </Alert>
          <Alert v-if="erroModelos" variant="destructive"><AlertDescription>{{ erroModelos }}</AlertDescription></Alert>
          <Button type="submit" class="justify-self-start">Salvar modelos</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle><h2 class="flex items-center gap-2"><MonitorPlay class="size-4" /> YouTube</h2></CardTitle>
        <CardDescription>
          Crie uma credencial OAuth do tipo "App para computador" no Google Cloud, com a YouTube Data API v3 ativada,
          e adicione sua conta como usuário de teste. Enquanto o app do Google Cloud não for verificado, os vídeos só podem ser enviados como privados.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-5">
        <form class="grid gap-4" novalidate @submit.prevent="salvarCredenciais">
          <Campo rotulo="Client ID"><Input v-model="credenciais.clientId" /></Campo>
          <Campo rotulo="Client Secret">
            <Input v-model="credenciais.clientSecret" type="password" autocomplete="off" placeholder="Deixe vazio para manter o atual" />
            <template v-if="segredoSalvo" #dica>Client Secret salvo neste computador.</template>
          </Campo>
          <Alert v-if="erroCredenciais" variant="destructive"><AlertDescription>{{ erroCredenciais }}</AlertDescription></Alert>
          <Button type="submit" class="justify-self-start">Salvar credenciais</Button>
        </form>

        <div class="grid gap-3">
          <h3 class="font-semibold">Canais conectados</h3>
          <Table>
            <TableBody>
              <TableRow v-for="canal in canais" :key="canal.idCanal">
                <TableCell class="font-medium">{{ canal.tituloCanal || "(sem título)" }}</TableCell>
                <TableCell class="text-muted-foreground">{{ canal.idCanal }}</TableCell>
                <TableCell class="text-right">
                  <Button variant="destructive" size="sm" @click="desconectar(canal)"><Unplug /> Desconectar</Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="!canais.length">
                <TableCell colspan="3" class="text-muted-foreground">Nenhum canal conectado.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Button variant="outline" class="justify-self-start" @click="conectar"><MonitorPlay /> Conectar conta do YouTube</Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle><h2 class="flex items-center gap-2"><Cpu class="size-4" /> Ollama</h2></CardTitle>
      </CardHeader>
      <CardContent class="grid gap-4">
        <dl class="grid gap-1.5 text-sm">
          <div class="grid gap-3 sm:grid-cols-[9rem_1fr]"><dt class="text-muted-foreground">Endereço</dt><dd>{{ status?.ollama.url }}</dd></div>
          <div class="grid gap-3 sm:grid-cols-[9rem_1fr]"><dt class="text-muted-foreground">Situação</dt><dd>{{ status?.ollama.online ? `Online, versão ${status.ollama.versao}` : "Fora do ar" }}</dd></div>
          <div class="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <dt class="text-muted-foreground">Contexto padrão</dt>
            <dd class="grid gap-1">
              <span v-if="contextoOllama?.emVigor" class="tabular-nums">{{ formatarNumero(contextoOllama.emVigor) }} tokens</span>
              <span v-else-if="contextoOllama?.configurado" class="tabular-nums">
                {{ formatarNumero(contextoOllama.configurado) }} tokens (configurado; não foi possível confirmar se já está em vigor)
              </span>
              <span v-else class="text-muted-foreground">Não foi possível ler (só o app do Ollama para Windows guarda esse valor)</span>
              <span
                v-if="contextoOllama?.emVigor && contextoOllama.configurado && contextoOllama.configurado !== contextoOllama.emVigor"
                class="flex items-start gap-1.5 text-amber-600 dark:text-amber-400"
              >
                <TriangleAlert class="mt-0.5 size-4 shrink-0" />
                Configurado no app do Ollama: {{ formatarNumero(contextoOllama.configurado) }} tokens. Reinicie o Ollama para esse valor valer.
              </span>
              <small class="text-muted-foreground">Vale só para quem não pede um contexto; o Gangoy Vídeos envia o seu a cada chamada.</small>
            </dd>
          </div>
        </dl>
        <Table v-if="modelos.length">
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead><TableHead>Tamanho</TableHead><TableHead>Parâmetros</TableHead><TableHead>Quantização</TableHead><TableHead>Contexto máximo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="modelo in modelos" :key="modelo.nome">
              <TableCell class="font-medium">{{ modelo.nome }}</TableCell>
              <TableCell class="tabular-nums">{{ formatarBytes(modelo.tamanhoBytes) }}</TableCell>
              <TableCell>{{ modelo.parametros }}</TableCell>
              <TableCell>{{ modelo.quantizacao }}</TableCell>
              <TableCell class="tabular-nums">{{ modelo.contextoMaximo ? formatarNumero(modelo.contextoMaximo) : "?" }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <PainelLateral :aberto="painelMover" titulo="Mudar a workspace de lugar" @fechar="painelMover = false">
      <div class="grid gap-4">
        <p class="text-sm text-muted-foreground">
          A pasta Gangoy-workspace inteira vai para o local escolhido. Em outro disco, o sistema copia, confere cada arquivo e só então apaga a origem.
        </p>
        <NavegadorPastas v-model="destino" />
        <Button :disabled="!destino" class="justify-self-start" @click="mover">Mover para cá</Button>
      </div>
    </PainelLateral>
  </section>
</template>
