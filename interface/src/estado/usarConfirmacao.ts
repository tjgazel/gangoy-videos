import { ref } from "vue";

export interface PedidoConfirmacao {
  titulo: string;
  texto: string;
  botao: string;
  responder: (sim: boolean) => void;
}

const pedido = ref<PedidoConfirmacao | null>(null);

// Substitui o window.confirm: diálogo do próprio sistema, com o texto da ação no botão.
export function confirmar(opcoes: { titulo: string; texto: string; botao: string }): Promise<boolean> {
  return new Promise((pronto) => {
    pedido.value = {
      ...opcoes,
      responder: (sim) => {
        pedido.value = null;
        pronto(sim);
      },
    };
  });
}

export function usarConfirmacao() {
  return { pedido };
}
