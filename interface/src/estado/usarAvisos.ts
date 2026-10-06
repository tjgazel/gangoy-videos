import { ref } from "vue";

export interface Aviso {
  id: number;
  texto: string;
  tipo: "sucesso" | "erro";
}

const avisos = ref<Aviso[]>([]);
let proximoId = 1;

export function avisar(texto: string, tipo: "sucesso" | "erro" = "sucesso"): void {
  const id = proximoId++;
  avisos.value.push({ id, texto, tipo });
  setTimeout(() => fechar(id), tipo === "erro" ? 9000 : 5000);
}

export function fechar(id: number): void {
  avisos.value = avisos.value.filter((aviso) => aviso.id !== id);
}

export function usarAvisos() {
  return { avisos, fechar };
}
