import { useColorMode, type BasicColorSchema } from "@vueuse/core";

const CHAVE = "gangoy.tema";

// Antes do shadcn-vue a preferência era salva como "escuro" ou "claro".
export function migrarTemaAntigo(): void {
  const antigo = localStorage.getItem(CHAVE);
  if (antigo === "escuro") localStorage.setItem(CHAVE, "dark");
  if (antigo === "claro") localStorage.setItem(CHAVE, "light");
}

let modo: ReturnType<typeof useColorMode<BasicColorSchema>> | undefined;

// Um só estado para o app inteiro: classe "dark" no <html>, escolha salva no navegador.
export function usarModoTema() {
  if (!modo) {
    migrarTemaAntigo();
    modo = useColorMode({ storageKey: CHAVE, initialValue: "dark", emitAuto: true });
  }
  return { modo };
}
