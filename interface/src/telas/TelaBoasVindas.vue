<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { chamarApi } from "../api/cliente";
import { Film, FolderOpen } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NavegadorPastas from "../componentes/NavegadorPastas.vue";
import { usarStatusSistema } from "../estado/usarStatusSistema";
import { usarProjetoAtual } from "../estado/usarProjetoAtual";

const roteador = useRouter();
const { status, recarregar } = usarStatusSistema();
const { recarregar: recarregarProjetos } = usarProjetoAtual();
const pasta = ref<string | null>(null);
const erro = ref("");
const ocupado = ref(false);

async function usar(rota: "/api/workspace" | "/api/workspace/apontar") {
  if (!pasta.value) return;
  erro.value = "";
  ocupado.value = true;
  try {
    const corpo = rota === "/api/workspace" ? { local: pasta.value } : { caminho: pasta.value };
    await chamarApi(rota, { metodo: "POST", corpo });
    await recarregar();
    await recarregarProjetos().catch(() => {});
    await roteador.push("/producao");
  } catch (falha) {
    erro.value = (falha as Error).message;
  } finally {
    ocupado.value = false;
  }
}

void recarregar().catch(() => {});
</script>
<template>
  <div class="grid min-h-svh place-items-center p-4">
    <Card class="w-full max-w-2xl">
      <CardHeader>
        <div class="mb-2 flex items-center gap-2 font-semibold"><Film class="size-5" /> Gangoy Vídeos</div>
        <CardTitle><h1 class="text-xl">Escolha onde guardar seus projetos</h1></CardTitle>
        <CardDescription>
          O sistema cria a pasta <strong>Gangoy-workspace</strong> no local escolhido. Nela ficam o banco, os roteiros,
          as imagens e os vídeos de todos os projetos. Para fazer backup ou levar para outro computador, basta copiar essa pasta.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <p v-if="status?.existemDadosAntigos" class="rounded-lg bg-muted p-3 text-sm">
          Os projetos que já existem em dados/ serão trazidos para a workspace.
        </p>

        <NavegadorPastas v-model="pasta" />

        <p class="text-sm text-muted-foreground">Evite pastas de rede (compartilhamentos do Windows, NAS): o banco de dados pode corromper.</p>
        <Alert v-if="erro" variant="destructive"><AlertDescription>{{ erro }}</AlertDescription></Alert>

        <div class="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" :disabled="!pasta || ocupado" @click="usar('/api/workspace/apontar')">
            <FolderOpen /> Abrir workspace existente
          </Button>
          <Button type="button" :disabled="!pasta || ocupado" @click="usar('/api/workspace')">Usar esta pasta</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
