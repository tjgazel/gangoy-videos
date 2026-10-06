<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { chamarApi } from "../api/cliente";
import type { Projeto } from "../api/tipos";
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
  <section class="tela">
    <header class="tela-cabecalho">
      <h1>Projetos</h1>
      <button type="button" class="botao principal" @click="abrirNovo">Novo projeto</button>
    </header>

    <p v-if="!projetos.length" class="vazio">Nenhum projeto ainda. Crie o primeiro para começar a planejar a história.</p>

    <div class="grade">
      <article v-for="projeto in projetos" :key="projeto.id" class="cartao-projeto">
        <div class="topo">
          <span class="inicial" data-testid="inicial" :style="{ background: cor(projeto.nome) }">{{ projeto.nome.charAt(0).toUpperCase() }}</span>
          <div>
            <h2>{{ projeto.nome }}</h2>
            <p class="suave">{{ projeto.tematica || "Sem temática" }}</p>
          </div>
        </div>
        <dl>
          <div><dt>Duração</dt><dd class="numeros">{{ projeto.duracaoPadraoMinutos }} min</dd></div>
          <div><dt>Canal</dt><dd>{{ projeto.idCanal || "Não definido" }}</dd></div>
          <div><dt>Modelo</dt><dd>{{ projeto.modeloOllama || "Padrão do sistema" }}</dd></div>
        </dl>
        <p v-if="projeto.modeloOllama && !instalado(projeto.modeloOllama)" class="etiqueta alerta">
          Modelo não instalado: {{ projeto.modeloOllama }}
        </p>
        <div class="acoes">
          <button type="button" class="botao" @click="abrirEdicao(projeto)">Editar</button>
          <button type="button" class="botao perigo" @click="excluir(projeto)">Excluir</button>
        </div>
      </article>
    </div>

    <PainelLateral :aberto="painelAberto" :titulo="editandoId ? 'Editar projeto' : 'Novo projeto'" @fechar="painelAberto = false">
      <form class="formulario" novalidate @submit.prevent="salvar">
        <label class="campo"><span>Nome do projeto</span><input v-model="formulario.nome" required /></label>
        <label class="campo"><span>Temática</span><input v-model="formulario.tematica" placeholder="Ex.: Fábulas de aventura" /></label>
        <label class="campo">
          <span>ID do canal no YouTube</span>
          <input v-model="formulario.idCanal" list="canais-conectados" placeholder="UC..." />
          <datalist id="canais-conectados">
            <option v-for="canal in canais" :key="canal.idCanal" :value="canal.idCanal">{{ canal.tituloCanal }}</option>
          </datalist>
        </label>
        <label class="campo"><span>ID da playlist padrão</span><input v-model="formulario.idPlaylist" placeholder="PL..." /></label>
        <label class="campo">
          <span>Frequência de produção</span>
          <input v-model="formulario.frequencia" />
          <small>Use diaria ou semanal:ter:18:00 (dia de seg a dom, hora HH:MM).</small>
        </label>
        <label class="campo">
          <span>Duração padrão (minutos)</span>
          <input v-model.number="formulario.duracaoPadraoMinutos" type="number" />
          <small>De 5 a 10 minutos por vídeo.</small>
        </label>
        <SeletorModelo v-model="formulario.modeloOllama" :permitir-padrao="true" :rotulo-padrao="rotuloPadrao" />
        <p v-if="erro" class="erro-texto" role="alert">{{ erro }}</p>
        <button type="submit" class="botao principal">{{ editandoId ? "Salvar alterações" : "Criar projeto" }}</button>
      </form>
    </PainelLateral>
  </section>
</template>

<style scoped>
.grade {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.cartao-projeto {
  display: grid;
  gap: 12px;
  align-content: start;
  background: var(--cartao);
  border: 1px solid var(--cartao-borda);
  border-radius: 10px;
  padding: 16px;
}
.topo { display: flex; gap: 12px; align-items: center; }
.inicial {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 17px;
  flex-shrink: 0;
}
.suave { margin: 0; color: var(--texto-suave); font-size: 13px; }
dl { margin: 0; display: grid; gap: 4px; font-size: 13px; }
dl div { display: flex; justify-content: space-between; gap: 12px; }
dt { color: var(--texto-suave); }
dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
.acoes { display: flex; gap: 8px; }
.formulario { display: grid; gap: 14px; }
.formulario small { color: var(--texto-suave); }
.formulario .botao.principal { justify-self: start; }
</style>
