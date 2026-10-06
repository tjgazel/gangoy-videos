import type { StatusSistema, Tarefa } from "./tipos";

// Um único EventSource para o app todo (/api/eventos). Reconecta sozinho.
type Ouvintes = { tarefa: Set<(dados: Tarefa) => void>; sistema: Set<(dados: StatusSistema) => void> };

const ouvintes: Ouvintes = { tarefa: new Set(), sistema: new Set() };
const aoAbrir = new Set<() => void>();
let fonte: EventSource | null = null;

function conectar(): void {
  if (fonte) return;
  fonte = new EventSource("/api/eventos");
  fonte.addEventListener("open", () => aoAbrir.forEach((ouvinte) => ouvinte()));
  // Resposta de erro (ex.: servidor reiniciando) faz o navegador desistir de vez: reconecta por conta própria.
  fonte.addEventListener("error", () => {
    if (fonte?.readyState !== EventSource.CLOSED) return;
    fonte = null;
    setTimeout(conectar, 3000);
  });
  fonte.addEventListener("tarefa", (evento) => {
    const dados = JSON.parse((evento as MessageEvent).data) as Tarefa;
    ouvintes.tarefa.forEach((ouvinte) => ouvinte(dados));
  });
  fonte.addEventListener("sistema", (evento) => {
    const dados = JSON.parse((evento as MessageEvent).data) as StatusSistema;
    ouvintes.sistema.forEach((ouvinte) => ouvinte(dados));
  });
}

export function aoEvento(tipo: "tarefa", ouvinte: (dados: Tarefa) => void): () => void;
export function aoEvento(tipo: "sistema", ouvinte: (dados: StatusSistema) => void): () => void;
export function aoEvento(tipo: "tarefa" | "sistema", ouvinte: (dados: never) => void): () => void {
  conectar();
  const conjunto = ouvintes[tipo] as Set<(dados: never) => void>;
  conjunto.add(ouvinte);
  return () => conjunto.delete(ouvinte);
}

// Chamado a cada (re)conexão: quem depende do estado recarrega da API para não perder eventos.
export function aoReconectar(ouvinte: () => void): () => void {
  conectar();
  aoAbrir.add(ouvinte);
  return () => aoAbrir.delete(ouvinte);
}
