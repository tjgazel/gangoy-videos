import { bancoAberto, obterBanco } from "../banco/banco.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { emitirEvento } from "./eventos.js";
import type { ContextoExecucao, Executor, StatusTarefa, Tarefa, TipoTarefa } from "./tipos.js";

// Fila única de trabalhos longos: uma tarefa por vez, em ordem de criação
// (a GPU não comporta Ollama e ComfyUI ao mesmo tempo).

interface LinhaTarefa {
  id: number;
  tipo: TipoTarefa;
  chave: string;
  projeto_id: number | null;
  capitulo_numero: number | null;
  parametros: string;
  status: StatusTarefa;
  progresso: number;
  mensagem: string;
  resultado: string | null;
  erro: string | null;
  criada_em: string;
  iniciada_em: string | null;
  concluida_em: string | null;
}

const MENSAGEM_INTERROMPIDA = "Interrompida: o servidor foi fechado durante a execução";
const DIAS_GUARDADOS = 30;

const executores = new Map<TipoTarefa, Executor>();
let ativa = false;
let processando: Promise<void> | null = null;
let atual: { tarefa: Tarefa; controle: AbortController; cancelada: boolean } | null = null;

function converter(linha: LinhaTarefa): Tarefa {
  return {
    id: linha.id,
    tipo: linha.tipo,
    chave: linha.chave,
    projetoId: linha.projeto_id,
    capituloNumero: linha.capitulo_numero,
    parametros: JSON.parse(linha.parametros) as Record<string, unknown>,
    status: linha.status,
    progresso: linha.progresso,
    mensagem: linha.mensagem,
    resultado: linha.resultado === null ? null : JSON.parse(linha.resultado),
    erro: linha.erro,
    criadaEm: linha.criada_em,
    iniciadaEm: linha.iniciada_em,
    concluidaEm: linha.concluida_em,
  };
}

function montarChave(tipo: TipoTarefa, projetoId: number | null, capituloNumero: number | null): string {
  return `${tipo}:${projetoId ?? "-"}:${capituloNumero ?? "-"}`;
}

export function registrarExecutor(tipo: TipoTarefa, executor: Executor): void {
  executores.set(tipo, executor);
}

export function buscarTarefa(id: number): Tarefa | null {
  const linha = obterBanco().prepare("SELECT * FROM tarefas WHERE id = ?").get(id) as LinhaTarefa | undefined;
  return linha ? converter(linha) : null;
}

export function listarTarefas(filtro: { projetoId?: number; status?: StatusTarefa[] } = {}): Tarefa[] {
  const condicoes: string[] = [];
  const valores: (string | number)[] = [];
  if (filtro.projetoId !== undefined) {
    condicoes.push("projeto_id = ?");
    valores.push(filtro.projetoId);
  }
  if (filtro.status?.length) {
    condicoes.push(`status IN (${filtro.status.map(() => "?").join(", ")})`);
    valores.push(...filtro.status);
  }
  const onde = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const linhas = obterBanco()
    .prepare(`SELECT * FROM tarefas ${onde} ORDER BY id DESC LIMIT 100`)
    .all(...valores) as unknown as LinhaTarefa[];
  return linhas.map(converter);
}

function emitir(tarefa: Tarefa): void {
  // Cópia: quem guarda o evento não deve ver mudanças posteriores.
  emitirEvento({ tipo: "tarefa", dados: { ...tarefa } });
}

// Grava a mudança (se o banco estiver aberto) e emite o evento com o estado em memória.
function atualizar(tarefa: Tarefa, mudancas: Partial<Tarefa>): Tarefa {
  Object.assign(tarefa, mudancas);
  // Erro de E/S no banco (ex.: HD removido) não pode derrubar o servidor: registra e segue avisando a tela.
  if (bancoAberto()) {
    try {
      obterBanco()
      .prepare(`
        UPDATE tarefas SET status = ?, progresso = ?, mensagem = ?, resultado = ?, erro = ?,
          iniciada_em = ?, concluida_em = ?
        WHERE id = ?
      `)
      .run(
        tarefa.status,
        tarefa.progresso,
        tarefa.mensagem,
        tarefa.resultado === null || tarefa.resultado === undefined ? null : JSON.stringify(tarefa.resultado),
        tarefa.erro,
        tarefa.iniciadaEm,
        tarefa.concluidaEm,
        tarefa.id,
      );
    } catch (erro) {
      console.error(`Não foi possível gravar a tarefa ${tarefa.id}:`, (erro as Error).message);
    }
  }
  emitir(tarefa);
  return tarefa;
}

export function criarTarefa(dados: {
  tipo: TipoTarefa;
  projetoId: number | null;
  capituloNumero: number | null;
  parametros?: Record<string, unknown>;
}): Tarefa {
  const chave = montarChave(dados.tipo, dados.projetoId, dados.capituloNumero);
  const repetida = obterBanco()
    .prepare("SELECT id FROM tarefas WHERE chave = ? AND status IN ('na_fila', 'executando')")
    .get(chave);
  if (repetida) throw new ErroAplicacao("Já existe uma tarefa para isso", 409);

  const resultado = obterBanco()
    .prepare(`
      INSERT INTO tarefas (tipo, chave, projeto_id, capitulo_numero, parametros, status, progresso, mensagem, criada_em)
      VALUES (?, ?, ?, ?, ?, 'na_fila', 0, '', ?)
    `)
    .run(
      dados.tipo,
      chave,
      dados.projetoId,
      dados.capituloNumero,
      JSON.stringify(dados.parametros ?? {}),
      new Date().toISOString(),
    );
  const tarefa = buscarTarefa(Number(resultado.lastInsertRowid)) as Tarefa;
  emitir(tarefa);
  acordarFila();
  return tarefa;
}

export function cancelarTarefa(id: number): Tarefa {
  const tarefa = buscarTarefa(id);
  if (!tarefa) throw new ErroAplicacao("Tarefa não encontrada", 404);
  if (tarefa.status === "na_fila") {
    return atualizar(tarefa, { status: "cancelada", concluidaEm: new Date().toISOString() });
  }
  if (tarefa.status === "executando" && atual?.tarefa.id === id) {
    atual.cancelada = true;
    atual.controle.abort();
    return atualizar(atual.tarefa, { status: "cancelada", concluidaEm: new Date().toISOString() });
  }
  throw new ErroAplicacao("A tarefa já terminou", 409);
}

export function repetirTarefa(id: number): Tarefa {
  const tarefa = buscarTarefa(id);
  if (!tarefa) throw new ErroAplicacao("Tarefa não encontrada", 404);
  if (tarefa.status !== "falhou" && tarefa.status !== "cancelada") {
    throw new ErroAplicacao("Só dá para repetir uma tarefa que falhou ou foi cancelada", 409);
  }
  return criarTarefa({
    tipo: tarefa.tipo,
    projetoId: tarefa.projetoId,
    capituloNumero: tarefa.capituloNumero,
    parametros: tarefa.parametros,
  });
}

// Ao iniciar o servidor: a que estava executando foi interrompida; registros antigos são apagados.
export function prepararFilaAoIniciar(): void {
  const banco = obterBanco();
  const agora = new Date().toISOString();
  // A que está rodando agora neste processo não foi interrompida.
  banco
    .prepare("UPDATE tarefas SET status = 'falhou', erro = ?, concluida_em = ? WHERE status = 'executando' AND id <> ?")
    .run(MENSAGEM_INTERROMPIDA, agora, atual?.tarefa.id ?? -1);
  const limite = new Date(Date.now() - DIAS_GUARDADOS * 24 * 3600 * 1000).toISOString();
  banco
    .prepare("DELETE FROM tarefas WHERE status IN ('concluida', 'falhou', 'cancelada') AND concluida_em < ?")
    .run(limite);
}

function proximaNaFila(): Tarefa | null {
  if (!bancoAberto()) return null;
  try {
    const linha = obterBanco()
      .prepare("SELECT * FROM tarefas WHERE status = 'na_fila' ORDER BY id LIMIT 1")
      .get() as LinhaTarefa | undefined;
    return linha ? converter(linha) : null;
  } catch (erro) {
    console.error("Não foi possível ler a fila:", (erro as Error).message);
    return null;
  }
}

function ehCancelamento(erro: unknown): boolean {
  return (erro as { name?: string })?.name === "AbortError";
}

async function executar(tarefa: Tarefa): Promise<void> {
  const controle = new AbortController();
  atual = { tarefa, controle, cancelada: false };
  const registro = atual;
  atualizar(tarefa, { status: "executando", iniciadaEm: new Date().toISOString() });

  const contexto: ContextoExecucao = {
    sinal: controle.signal,
    relatarProgresso: (porcentagem, mensagem) => {
      if (registro.cancelada) return;
      atualizar(tarefa, { progresso: Math.round(porcentagem), mensagem });
    },
  };

  try {
    const executor = executores.get(tarefa.tipo);
    if (!executor) throw new ErroAplicacao(`Tipo de tarefa sem executor: ${tarefa.tipo}`, 500);
    const resultado = await executor(tarefa, contexto);
    if (!registro.cancelada) {
      atualizar(tarefa, {
        status: "concluida",
        progresso: 100,
        resultado: resultado ?? null,
        concluidaEm: new Date().toISOString(),
      });
    }
  } catch (erro) {
    if (registro.cancelada || ehCancelamento(erro)) {
      if (tarefa.status !== "cancelada") atualizar(tarefa, { status: "cancelada", concluidaEm: new Date().toISOString() });
    } else {
      if (!(erro instanceof ErroAplicacao)) console.error(erro);
      atualizar(tarefa, { status: "falhou", erro: (erro as Error).message, concluidaEm: new Date().toISOString() });
    }
  } finally {
    atual = null;
  }
}

async function processar(): Promise<void> {
  let tarefa = proximaNaFila();
  while (ativa && tarefa) {
    await executar(tarefa);
    tarefa = proximaNaFila();
  }
}

function acordarFila(): void {
  if (!ativa || processando) return;
  processando = processar()
    .catch((erro) => console.error("Falha na fila de tarefas:", erro))
    .finally(() => {
    processando = null;
    // Pode ter chegado tarefa nova enquanto a última terminava.
    if (ativa && proximaNaFila()) acordarFila();
  });
}

export function haTarefaEmExecucao(): boolean {
  return atual !== null;
}

export function haTarefaAtivaDoProjeto(projetoId: number): boolean {
  return Boolean(
    obterBanco()
      .prepare("SELECT 1 FROM tarefas WHERE projeto_id = ? AND status IN ('na_fila', 'executando') LIMIT 1")
      .get(projetoId),
  );
}

export function iniciarFila(): void {
  ativa = true;
  acordarFila();
}

export async function pararFila(): Promise<void> {
  ativa = false;
  if (atual) {
    atual.cancelada = true;
    atual.controle.abort();
  }
  await processando;
}

// Para testes: resolve quando não há nada executando nem esperando.
export async function aguardarFilaOciosa(): Promise<void> {
  while (processando || (ativa && proximaNaFila())) {
    await (processando ?? new Promise((pronto) => setTimeout(pronto, 5)));
  }
}
