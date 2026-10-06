<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { ArrowLeft, Folder, FolderPlus, HardDrive } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chamarApi } from "../api/cliente";

interface Listagem {
  caminho: string | null;
  pai: string | null;
  pastas: { nome: string; caminho: string }[];
  raizes: { nome: string; caminho: string }[];
}

const props = defineProps<{ modelValue: string | null }>();
const emitir = defineEmits<{ "update:modelValue": [caminho: string | null] }>();

const listagem = ref<Listagem | null>(null);
const digitado = ref(props.modelValue ?? "");
const erro = ref("");
const criando = ref(false);
const nomeNova = ref("");

async function abrir(caminho: string | null) {
  erro.value = "";
  try {
    const consulta = caminho ? `?caminho=${encodeURIComponent(caminho)}` : "";
    listagem.value = await chamarApi<Listagem>(`/api/sistema/pastas${consulta}`);
    digitado.value = listagem.value.caminho ?? "";
    emitir("update:modelValue", listagem.value.caminho);
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

async function criarPasta() {
  if (!listagem.value?.caminho) return;
  erro.value = "";
  try {
    await chamarApi("/api/sistema/pastas", {
      metodo: "POST",
      corpo: { caminhoPai: listagem.value.caminho, nome: nomeNova.value },
    });
    criando.value = false;
    nomeNova.value = "";
    await abrir(listagem.value.caminho);
  } catch (falha) {
    erro.value = (falha as Error).message;
  }
}

watch(
  () => props.modelValue,
  (valor) => {
    if (valor && valor !== listagem.value?.caminho) void abrir(valor);
  },
);
onMounted(() => abrir(props.modelValue));
</script>
<template>
  <div class="grid gap-3">
    <div v-if="listagem?.raizes.length" class="flex flex-wrap gap-2">
      <Button v-for="raiz in listagem.raizes" :key="raiz.caminho" type="button" variant="outline" size="sm" @click="abrir(raiz.caminho)">
        <HardDrive /> {{ raiz.nome }}
      </Button>
    </div>

    <form class="flex gap-2" @submit.prevent="abrir(digitado)">
      <Input v-model="digitado" aria-label="Caminho da pasta" placeholder="Cole ou digite um caminho" />
      <Button type="submit" variant="outline">Abrir</Button>
    </form>

    <Alert v-if="erro" variant="destructive"><AlertDescription>{{ erro }}</AlertDescription></Alert>

    <div v-if="listagem?.caminho" class="overflow-hidden rounded-lg border">
      <div class="flex items-center gap-2 border-b bg-muted/50 p-2">
        <Button type="button" variant="outline" size="sm" :disabled="!listagem.pai" @click="abrir(listagem.pai)"><ArrowLeft /> Voltar</Button>
        <span class="min-w-0 flex-1 truncate text-sm" data-testid="caminho-atual">{{ listagem.caminho }}</span>
        <Button type="button" variant="outline" size="sm" @click="criando = !criando"><FolderPlus /> Nova pasta</Button>
      </div>
      <form v-if="criando" class="flex gap-2 border-b p-2" @submit.prevent="criarPasta">
        <Input v-model="nomeNova" aria-label="Nome da nova pasta" placeholder="Nome da pasta" />
        <Button type="submit">Criar pasta</Button>
      </form>
      <ScrollArea class="h-60">
        <ul class="grid p-1">
          <li v-for="pasta in listagem.pastas" :key="pasta.caminho">
            <Button type="button" variant="ghost" class="w-full justify-start" @click="abrir(pasta.caminho)">
              <Folder /> {{ pasta.nome }}
            </Button>
          </li>
          <li v-if="!listagem.pastas.length" class="p-2 text-sm text-muted-foreground">Nenhuma subpasta aqui.</li>
        </ul>
      </ScrollArea>
    </div>
    <p v-else class="text-sm text-muted-foreground">Escolha uma unidade ou cole um caminho para começar.</p>
  </div>
</template>
