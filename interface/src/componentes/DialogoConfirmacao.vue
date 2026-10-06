<script setup lang="ts">
import { ref, watch } from "vue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usarConfirmacao, type PedidoConfirmacao } from "../estado/usarConfirmacao";

const { pedido } = usarConfirmacao();

// O texto continua na tela durante a animação de fechar, depois que o pedido já foi respondido.
const exibido = ref<PedidoConfirmacao | null>(null);
watch(pedido, (atual) => {
  if (atual) exibido.value = atual;
});

// Fechar sem clicar na ação (Esc, clique fora, Voltar) é responder "não". Clicar na ação também fecha o
// diálogo; o adiamento deixa o clique responder "sim" antes, e aí não resta pedido para responder "não".
function aoMudarAberto(aberto: boolean) {
  if (!aberto) setTimeout(() => pedido.value?.responder(false));
}
</script>

<template>
  <AlertDialog :open="pedido !== null" @update:open="aoMudarAberto">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ exibido?.titulo }}</AlertDialogTitle>
        <AlertDialogDescription>{{ exibido?.texto }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Voltar</AlertDialogCancel>
        <AlertDialogAction @click="pedido?.responder(true)">{{ exibido?.botao }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
