// Números e tamanhos no formato brasileiro.
export function formatarNumero(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let valor = bytes / 1024;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice++;
  }
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unidades[indice]}`;
}

// 9800 de 32768 -> "9,8 mil de 32 mil"
export function formatarMil(valor: number): string {
  return `${(valor / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}
