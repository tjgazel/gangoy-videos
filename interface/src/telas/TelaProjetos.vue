<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { chamarApi } from "../api/cliente";
import type { Projeto } from "../api/tipos";
import { FolderKanban, Pencil, Plus, Trash2 } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CabecalhoTela from "../componentes/CabecalhoTela.vue";
import PainelLateral from "../componentes/PainelLateral.vue";
import SeletorModelo from "../componentes/SeletorModelo.vue";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";
import { usarModelos } from "../estado/usarModelos";
import { confirmar } from "../estado/usarConfirmacao";
import { avisar } from "../estado/usarAvisos";

const { projetos, recarregar } = usarProjetoAtual();
const { configuracoes, recarregar: recarregarModelos, instalado } = usarModelos();
const canais = ref<{ idCanal: string; tituloCanal: string }[]>([]);

const vazio = () => ({
  nome: "",
  tematica: "",
  idCanal: "",
  idPlaylist: "",
  frequencia: "semanal:ter:18:00",
  duracaoPadraoMinutos: 8,
  modeloOllama: "",
});
const formulario = reactive(vazio());
const editandoId = ref<number | null>(null);
const painelAberto = ref(false);
const erro = ref("");

const rotuloPadrao = computed(() =>
  configuracoes.value ? `Padrão do sistema (${configuracoes.value.modeloPrincipal})` : "Padrão do sistema",
);

// Cor estável por projeto, derivada do nome (ajuda a reconhecer o projeto no quadro).
function cor(nome: string): string {
  let soma = 0;
  for (const letra of nome) soma = (soma * 31 + letra.charCodeAt(0)) % 360;
  return `hsl(${soma} 62% 52%)`;
}

function abrirNovo() {
  Object.assign(formulario, vazio());
  editandoId.value = null;
  erro.value = "";
  painelAberto.value = true;
}

function abrirEdicao(projeto: Projeto) {
  Object.assign(formulario, {
    nome: projeto.nome,
    tematica: projeto.tematica,
    idCanal: projeto.idCanal,
    idPlaylist: projeto.idPlaylist,
    frequencia: projeto.frequencia,
    duracaoPadraoMinutos: projeto.duracaoPadraoMinutos,
    modeloOllama: projeto.modeloOllama,
  });
  editandoId.value = projeto.id;
  erro.value = "";
  painelAberto.value = true;
}

async function salvar() {
  erro.value = "";
  const corpo = { ...formulario, duracaoPadraoMinutos: Number(formulario.duracaoPadraoMinutos) };
  try {
    if (editandoId.value) {
      await chamarApi(`/api/projetos/${editandoId.value}`, { metodo: "PUT", corpo });
      avisar("Alterações salvas");
    } else {
      await chamarApi("/api/projetos", { metodo: "POST", corpo });
      avisar("Projeto criado");
    }
    painelAberto.value = false;
    await recarregar();
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

async function excluir(projeto: Projeto) {
  const sim = await confirmar({
    titulo: `Excluir o projeto "${projeto.nome}"?`,
    texto: "Os capítulos saem da lista. A pasta do projeto vai para a lixeira da workspace (.lixeira) e pode ser recuperada.",
    botao: "Excluir projeto",
  });
  if (!sim) return;
  try {
    await chamarApi(`/api/projetos/${projeto.id}`, { metodo: "DELETE" });
    avisar("Projeto excluído");
    await recarregar();
  } catch (falha) {
    avisar((falha as Error).message, "erro");
  }
}

onMounted(async () => {
  await Promise.all([recarregar().catch(() => {}), recarregarModelos()]);
  canais.value = await chamarApi<{ contas: { idCanal: string; tituloCanal: string }[] }>("/api/youtube/contas")
    .then((dados) => dados.contas)
    .catch(() => []);
});
</script>
<template>
  <section class="mx-auto grid max-w-6xl gap-6">
    <CabecalhoTela titulo="Projetos">
      <Button @click="abrirNovo"><Plus /> Novo projeto</Button>
    </CabecalhoTela>

    <Empty v-if="!projetos.length" class="border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><FolderKanban /></EmptyMedia>
        <EmptyTitle>Nenhum projeto ainda.</EmptyTitle>
        <EmptyDescription>Crie o primeiro para começar a planejar a história.</EmptyDescription>
      </EmptyHeader>
    </Empty>

    <div class="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
      <Card v-for="projeto in projetos" :key="projeto.id" role="article">
        <CardHeader>
          <div class="flex items-center gap-3">
            <span
              class="grid size-10 shrink-0 place-items-center rounded-lg font-bold text-white"
              data-testid="inicial"
              :style="{ background: cor(projeto.nome) }"
            >{{ projeto.nome.charAt(0).toUpperCase() }}</span>
            <div class="grid min-w-0">
              <CardTitle><h2 class="truncate">{{ projeto.nome }}</h2></CardTitle>
              <CardDescription>{{ projeto.tematica || "Sem temática" }}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent class="grid gap-3">
          <dl class="grid gap-1 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Duração</dt><dd class="tabular-nums">{{ projeto.duracaoPadraoMinutos }} min</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Canal</dt><dd class="break-all text-right">{{ projeto.idCanal || "Não definido" }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Modelo</dt><dd class="break-all text-right">{{ projeto.modeloOllama || "Padrão do sistema" }}</dd></div>
          </dl>
          <Badge v-if="projeto.modeloOllama && !instalado(projeto.modeloOllama)" variant="destructive" class="justify-self-start">
            Modelo não instalado: {{ projeto.modeloOllama }}
          </Badge>
        </CardContent>
        <CardFooter class="gap-2 border-t">
          <Button variant="outline" size="sm" @click="abrirEdicao(projeto)"><Pencil /> Editar</Button>
          <Button variant="destructive" size="sm" @click="excluir(projeto)"><Trash2 /> Excluir</Button>
        </CardFooter>
      </Card>
    </div>

    <PainelLateral :aberto="painelAberto" :titulo="editandoId ? 'Editar projeto' : 'Novo projeto'" @fechar="painelAberto = false">
      <form class="grid gap-4" novalidate @submit.prevent="salvar">
        <div class="grid gap-2">
          <Label for="projeto-nome">Nome do projeto</Label>
          <Input id="projeto-nome" v-model="formulario.nome" required />
        </div>
        <div class="grid gap-2">
          <Label for="projeto-tematica">Temática</Label>
          <Input id="projeto-tematica" v-model="formulario.tematica" placeholder="Ex.: Fábulas de aventura" />
        </div>
        <div class="grid gap-2">
          <Label for="projeto-canal">ID do canal no YouTube</Label>
          <Input id="projeto-canal" v-model="formulario.idCanal" list="canais-conectados" placeholder="UC..." />
          <datalist id="canais-conectados">
            <option v-for="canal in canais" :key="canal.idCanal" :value="canal.idCanal">{{ canal.tituloCanal }}</option>
          </datalist>
        </div>
        <div class="grid gap-2">
          <Label for="projeto-playlist">ID da playlist padrão</Label>
          <Input id="projeto-playlist" v-model="formulario.idPlaylist" placeholder="PL..." />
        </div>
        <div class="grid gap-2">
          <Label for="projeto-frequencia">Frequência de produção</Label>
          <Input id="projeto-frequencia" v-model="formulario.frequencia" />
          <p class="text-xs text-muted-foreground">Use diaria ou semanal:ter:18:00 (dia de seg a dom, hora HH:MM).</p>
        </div>
        <div class="grid gap-2">
          <Label for="projeto-duracao">Duração padrão (minutos)</Label>
          <Input id="projeto-duracao" v-model="formulario.duracaoPadraoMinutos" type="number" />
          <p class="text-xs text-muted-foreground">De 5 a 10 minutos por vídeo.</p>
        </div>
        <SeletorModelo v-model="formulario.modeloOllama" :permitir-padrao="true" :rotulo-padrao="rotuloPadrao" />
        <Alert v-if="erro" variant="destructive"><AlertDescription>{{ erro }}</AlertDescription></Alert>
        <Button type="submit" class="justify-self-start">{{ editandoId ? "Salvar alterações" : "Criar projeto" }}</Button>
      </form>
    </PainelLateral>
  </section>
</template>
