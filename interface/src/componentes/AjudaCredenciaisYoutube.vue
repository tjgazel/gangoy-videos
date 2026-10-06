<script setup lang="ts">
// Passo a passo para criar a credencial OAuth no Google Cloud. Baseado nas páginas oficiais do Google
// (links no fim); os nomes dos menus são os do console em português.
import { CircleHelp, ExternalLink } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const links = [
  { texto: "Registrar um aplicativo (YouTube Data API)", url: "https://developers.google.com/youtube/registering_an_application" },
  { texto: "OAuth 2.0 para aplicativos instalados (Desktop app)", url: "https://developers.google.com/youtube/v3/guides/auth/installed-apps" },
  { texto: "Primeiros passos e cota da YouTube Data API", url: "https://developers.google.com/youtube/v3/getting-started" },
  { texto: "Configurar OAuth 2.0 no Google Cloud", url: "https://support.google.com/cloud/answer/6158849" },
  { texto: "Validade do refresh token (modo de teste)", url: "https://developers.google.com/identity/protocols/oauth2#expiration" },
  { texto: "videos.insert: envios de projetos não verificados", url: "https://developers.google.com/youtube/v3/docs/videos/insert" },
];
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button type="button" variant="outline" size="sm" class="w-fit justify-self-start"><CircleHelp /> Como obter as credenciais</Button>
    </DialogTrigger>
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Como criar as credenciais do YouTube</DialogTitle>
        <DialogDescription>
          O Gangoy Vídeos envia os vídeos ao seu canal com uma credencial OAuth <strong>sua</strong>, criada no Google Cloud (gratuito).
          Tudo fica neste computador. Você faz isto uma vez.
        </DialogDescription>
      </DialogHeader>

      <ol class="list-decimal space-y-4 pl-5 text-sm marker:font-semibold">
        <li class="pl-1">
          <strong class="block">Crie um projeto no Google Cloud</strong>
          <span>
            Entre em <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" class="underline">console.cloud.google.com</a>
            com a conta dona do canal, abra o seletor de projetos (no topo) e clique em <em>Novo projeto</em>.
          </span>
        </li>
        <li class="pl-1">
          <strong class="block">Ative a YouTube Data API v3</strong>
          <span>
            Em <em>APIs e serviços › Biblioteca</em>, procure por <em>YouTube Data API v3</em> e clique em <em>Ativar</em>
            (<a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer" class="underline">atalho</a>).
          </span>
        </li>
        <li class="pl-1">
          <strong class="block">Configure a tela de consentimento (Google Auth Platform)</strong>
          <span>
            Em <em>Google Auth Platform</em>, siga o assistente inicial: nome do app e e-mail de suporte.
            No <em>Público-alvo</em>, escolha <em>Externo</em> e deixe o status <em>Em teste</em>.
            Em <em>Usuários de teste</em>, adicione o e-mail da conta dona do canal.
            Em <em>Acesso a dados</em>, adicione os escopos <code>youtube.upload</code> e <code>youtube.force-ssl</code>, que o app usa.
          </span>
        </li>
        <li class="pl-1">
          <strong class="block">Crie o cliente OAuth</strong>
          <span>
            Em <em>Google Auth Platform › Clientes</em>
            (<a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer" class="underline">atalho</a>),
            clique em <em>Criar cliente</em>, escolha o tipo de aplicativo <strong>Desktop app</strong> (App para computador), dê um nome e crie.
            O Google mostra o <strong>Client ID</strong> e o <strong>Client Secret</strong>: o segredo só aparece na criação, então copie e guarde.
          </span>
        </li>
        <li class="pl-1">
          <strong class="block">Cole aqui e conecte</strong>
          <span>
            Cole o Client ID e o Client Secret nos campos desta tela, salve e clique em <em>Conectar conta do YouTube</em>.
            Como o app não foi verificado pelo Google, aparece o aviso de app não verificado: é esperado, escolha
            <em>Avançado</em> e continue. O retorno é feito neste computador (127.0.0.1), sem cadastrar endereço nenhum.
          </span>
        </li>
      </ol>

      <div class="grid gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <strong>O que esperar enquanto o app está em teste</strong>
        <ul class="grid list-disc gap-1 pl-5">
          <li>
            <strong>A conexão expira em 7 dias.</strong> Para apps externos com status <em>Em teste</em>, o Google emite um refresh token
            que vale 7 dias: depois disso é preciso clicar em <em>Conectar conta do YouTube</em> de novo.
          </li>
          <li>
            <strong>Os vídeos são enviados como privados.</strong> Projetos de API não verificados, criados depois de 28/07/2020,
            só publicam como privado até passarem por uma auditoria do Google. Dá para torná-los públicos manualmente no YouTube Studio.
          </li>
          <li>
            <strong>Cota padrão:</strong> 100 envios por dia por projeto. Dá para pedir mais ao Google.
          </li>
        </ul>
      </div>

      <div class="grid gap-1.5 text-sm">
        <strong>Páginas oficiais do Google</strong>
        <ul class="grid gap-1">
          <li v-for="link in links" :key="link.url">
            <a :href="link.url" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 underline">
              {{ link.texto }} <ExternalLink class="size-3.5" />
            </a>
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>
