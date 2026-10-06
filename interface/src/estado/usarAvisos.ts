import { toast } from "vue-sonner";

// Avisos rápidos (toasts). O <Toaster> fica em componentes/Aviso.vue.
export function avisar(texto: string, tipo: "sucesso" | "erro" = "sucesso"): void {
  const mostrar = tipo === "erro" ? toast.error : toast.success;
  mostrar(texto, { duration: tipo === "erro" ? 9000 : 5000 });
}
