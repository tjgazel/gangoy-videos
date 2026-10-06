<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { chamarApi } from "../api/cliente";
import type { ConfiguracoesSistema } from "../api/tipos";
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

// ---- Modelos ----
const formularioModelos = reactive<ConfiguracoesSistema>({ modeloPrincipal: "", modeloLeve: "", contextoTrabalho: 32768 });
const erroModelos = ref("");
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
  await Promise.all([carregarDadosAntigos().catch(() => {}), carregarYoutube().catch(() => {})]);
});
</script>

<template>
  <section class="tela">
    <header class="tela-cabecalho"><h1>Configurações</h1></header>

    <section class="painel secao">
      <h2>Workspace</h2>
      <dl class="dados">
        <div><dt>Local</dt><dd>{{ status?.workspace.caminho ?? "Não configurada" }}</dd></div>
        <div v-if="status?.workspace.espacoLivreBytes !== null && status?.workspace.espacoLivreBytes !== undefined">
          <dt>Espaço livre</dt><dd class="numeros">{{ formatarBytes(status.workspace.espacoLivreBytes) }}</dd>
        </div>
      </dl>
      <div v-if="movendo && (movendo.status === 'na_fila' || movendo.status === 'executando')" class="progresso">
        <span>{{ movendo.mensagem || "Mudança na fila" }}</span>
        <BarraProgresso :valor="movendo.progresso" rotulo="Mudança da workspace" />
      </div>
      <div class="acoes">
        <button type="button" class="botao" @click="painelMover = true">Mudar local</button>
        <RouterLink to="/boas-vindas" class="botao">Apontar outro local</RouterLink>
        <button v-if="dadosAntigos.length" type="button" class="botao perigo" @click="apagarDadosAntigos">
          Apagar dados antigos já convertidos
        </button>
      </div>
    </section>

    <section class="painel secao">
      <h2>Modelos</h2>
      <p class="ajuda">Escolha entre os modelos já instalados no Ollama. Para instalar outros, use o próprio Ollama.</p>
      <form class="formulario" novalidate @submit.prevent="salvarModelos">
        <SeletorModelo v-model="formularioModelos.modeloPrincipal" :permitir-padrao="false" rotulo="Modelo principal" />
        <SeletorModelo v-model="formularioModelos.modeloLeve" :permitir-padrao="false" rotulo="Modelo leve" />
        <label class="campo">
          <span>Contexto de trabalho (tokens)</span>
          <input v-model.number="formularioModelos.contextoTrabalho" type="number" step="1024" />
          <small v-if="principalEscolhido?.contextoMaximo">
            O modelo principal aceita até {{ formatarNumero(principalEscolhido.contextoMaximo) }} tokens. Contexto maior usa mais memória da placa de vídeo.
          </small>
        </label>
        <p v-if="principalEscolhido?.percentualCpu" class="etiqueta alerta">
          {{ principalEscolhido.nome }}: {{ principalEscolhido.percentualCpu }}% na CPU (mais lento). Reduza o contexto ou use um modelo menor.
        </p>
        <p v-if="erroModelos" class="erro-texto" role="alert">{{ erroModelos }}</p>
        <button type="submit" class="botao principal">Salvar modelos</button>
      </form>
    </section>

    <section class="painel secao">
      <h2>YouTube</h2>
      <p class="ajuda">
        Crie uma credencial OAuth do tipo "App para computador" no Google Cloud, com a YouTube Data API v3 ativada,
        e adicione sua conta como usuário de teste. Enquanto o app do Google Cloud não for verificado, os vídeos só podem ser enviados como privados.
      </p>
      <form class="formulario" novalidate @submit.prevent="salvarCredenciais">
        <label class="campo"><span>Client ID</span><input v-model="credenciais.clientId" /></label>
        <label class="campo">
          <span>Client Secret</span>
          <input v-model="credenciais.clientSecret" type="password" autocomplete="off" placeholder="Deixe vazio para manter o atual" />
          <small v-if="segredoSalvo">Client Secret salvo neste computador.</small>
        </label>
        <p v-if="erroCredenciais" class="erro-texto" role="alert">{{ erroCredenciais }}</p>
        <button type="submit" class="botao principal">Salvar credenciais</button>
      </form>
      <h3>Canais conectados</h3>
      <ul class="canais">
        <li v-for="canal in canais" :key="canal.idCanal">
          <span>{{ canal.tituloCanal || "(sem título)" }}</span>
          <small>{{ canal.idCanal }}</small>
          <button type="button" class="botao perigo" @click="desconectar(canal)">Desconectar</button>
        </li>
        <li v-if="!canais.length" class="vazio">Nenhum canal conectado.</li>
      </ul>
      <button type="button" class="botao" @click="conectar">Conectar conta do YouTube</button>
    </section>

    <section class="painel secao">
      <h2>Ollama</h2>
      <dl class="dados">
        <div><dt>Endereço</dt><dd>{{ status?.ollama.url }}</dd></div>
        <div><dt>Situação</dt><dd>{{ status?.ollama.online ? `Online, versão ${status.ollama.versao}` : "Fora do ar" }}</dd></div>
      </dl>
      <table v-if="modelos.length" class="tabela">
        <thead>
          <tr><th>Modelo</th><th>Tamanho</th><th>Parâmetros</th><th>Quantização</th><th>Contexto máximo</th></tr>
        </thead>
        <tbody>
          <tr v-for="modelo in modelos" :key="modelo.nome">
            <td>{{ modelo.nome }}</td>
            <td class="numeros">{{ formatarBytes(modelo.tamanhoBytes) }}</td>
            <td>{{ modelo.parametros }}</td>
            <td>{{ modelo.quantizacao }}</td>
            <td class="numeros">{{ modelo.contextoMaximo ? formatarNumero(modelo.contextoMaximo) : "?" }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <PainelLateral :aberto="painelMover" titulo="Mudar a workspace de lugar" @fechar="painelMover = false">
      <div class="formulario">
        <p class="ajuda">
          A pasta Gangoy-workspace inteira vai para o local escolhido. Em outro disco, o sistema copia, confere cada arquivo e só então apaga a origem.
        </p>
        <NavegadorPastas v-model="destino" />
        <button type="button" class="botao principal" :disabled="!destino" @click="mover">Mover para cá</button>
      </div>
    </PainelLateral>
  </section>
</template>

<style scoped>
.secao { display: grid; gap: 14px; max-width: 860px; }
.ajuda { margin: 0; color: var(--texto-suave); max-width: 72ch; }
.dados { margin: 0; display: grid; gap: 6px; }
.dados div { display: grid; grid-template-columns: 140px 1fr; gap: 12px; }
.dados dt { color: var(--texto-suave); }
.dados dd { margin: 0; overflow-wrap: anywhere; }
.acoes { display: flex; flex-wrap: wrap; gap: 8px; }
.progresso { display: grid; gap: 6px; }
.formulario { display: grid; gap: 14px; max-width: 520px; }
.formulario small { color: var(--texto-suave); }
.formulario .botao.principal { justify-self: start; }
.canais { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.canais li { display: flex; gap: 10px; align-items: center; }
.canais small { color: var(--texto-suave); margin-right: auto; }
.tabela { width: 100%; border-collapse: collapse; font-size: 13px; }
.tabela th { text-align: left; color: var(--texto-suave); font-weight: 500; }
.tabela th, .tabela td { padding: 6px 8px; border-bottom: 1px solid var(--cartao-borda); }
</style>
