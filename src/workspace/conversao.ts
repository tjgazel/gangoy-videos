import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { lerConfiguracaoApp } from "../nucleo/configuracaoApp.js";
import { ErroAplicacao } from "../nucleo/erros.js";
import { obterOpcoesExecucao } from "../nucleo/opcoesExecucao.js";
import { copiarConferindo, medirPasta } from "./copiaConferida.js";
import { ARQUIVO_BANCO } from "./workspace.js";

// Formato anterior à workspace: dados/app.db e dados/projetos/<slug>/capitulos/NNN/versoes/.
const BANCO_ANTIGO = "app.db";
const PROJETOS_ANTIGOS = "projetos";
const SUFIXO = ".migrado";
// Só o que a conversão renomeia; outros *.migrado em dados/ não são nossos.
const RENOMEADOS = [BANCO_ANTIGO, `${BANCO_ANTIGO}-wal`, `${BANCO_ANTIGO}-shm`, PROJETOS_ANTIGOS];

export function existemDadosAntigos(pastaDados: string): boolean {
  return existsSync(join(pastaDados, BANCO_ANTIGO)) || existsSync(join(pastaDados, PROJETOS_ANTIGOS));
}

// capitulos/001/versoes -> capitulos/capitulo-001/roteiro (dentro da cópia do projeto).
function reorganizarCapitulos(pastaProjeto: string): void {
  const capitulos = join(pastaProjeto, "capitulos");
  if (!existsSync(capitulos)) return;
  for (const nome of readdirSync(capitulos)) {
    if (!/^\d{3}$/.test(nome)) continue;
    const antiga = join(capitulos, nome);
    const nova = join(capitulos, `capitulo-${nome}`);
    renameSync(antiga, nova);
    if (existsSync(join(nova, "versoes"))) renameSync(join(nova, "versoes"), join(nova, "roteiro"));
  }
}

function copiarBanco(pastaDados: string, pastaWorkspace: string): void {
  const origem = join(pastaDados, BANCO_ANTIGO);
  if (!existsSync(origem)) return;
  // Leva o que estiver no WAL para o arquivo principal antes de copiar.
  const conexao = new DatabaseSync(origem);
  conexao.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  conexao.close();

  const destino = join(pastaWorkspace, ARQUIVO_BANCO);
  copyFileSync(origem, destino);
  if (statSync(destino).size !== statSync(origem).size) {
    throw new ErroAplicacao(`A cópia não confere: ${BANCO_ANTIGO}`, 500);
  }

  // Projeto que usava o modelo padrão passa a seguir o padrão do sistema.
  const novo = new DatabaseSync(destino);
  try {
    novo.prepare("UPDATE projetos SET modelo_ollama = '' WHERE modelo_ollama = ?").run(lerConfiguracaoApp().ollama.modeloPadrao);
  } finally {
    novo.close(); // aberto, impediria apagar a workspace nova ao desfazer (Windows)
  }
}

export function converterDadosAntigos(
  pastaDados: string,
  pastaWorkspace: string,
  dependencias: { copiar?: typeof copiarConferindo; renomear?: (origem: string, alvo: string) => void } = {},
): { projetos: string[]; arquivos: number } {
  const copiar = dependencias.copiar ?? copiarConferindo;
  const renomear = dependencias.renomear ?? renameSync;

  // Conversão interrompida antes (banco já renomeado, projetos não): continuar criaria uma workspace sem banco.
  if (
    !existsSync(join(pastaDados, BANCO_ANTIGO)) &&
    existsSync(join(pastaDados, BANCO_ANTIGO + SUFIXO)) &&
    existsSync(join(pastaDados, PROJETOS_ANTIGOS))
  ) {
    throw new ErroAplicacao(
      "Os dados antigos estão pela metade: dados/app.db já foi convertido, mas dados/projetos/ não. Renomeie dados/app.db.migrado de volta para dados/app.db e tente de novo.",
      409,
    );
  }
  const projetos: string[] = [];
  let arquivos = 0;
  try {
    copiarBanco(pastaDados, pastaWorkspace);
    const pastaProjetos = join(pastaDados, PROJETOS_ANTIGOS);
    if (existsSync(pastaProjetos)) {
      for (const slug of readdirSync(pastaProjetos)) {
        if (!statSync(join(pastaProjetos, slug)).isDirectory()) continue;
        const destino = join(pastaWorkspace, slug);
        arquivos += copiar(join(pastaProjetos, slug), destino).arquivos;
        reorganizarCapitulos(destino);
        projetos.push(slug);
      }
    }
  } catch (erro) {
    const motivo = (erro as Error).message.replace(/\.$/, "");
    throw new ErroAplicacao(
      `A conversão dos dados antigos falhou: ${motivo}. Os dados originais continuam em dados/.`,
      500,
    );
  }

  // Só depois de tudo conferido: os originais ficam com o sufixo .migrado (nada é apagado aqui).
  // Se uma renomeação falhar, desfaz as anteriores para dados/ ficar como estava.
  const renomeados: string[] = [];
  try {
    for (const nome of RENOMEADOS) {
      const caminho = join(pastaDados, nome);
      if (!existsSync(caminho)) continue;
      renomear(caminho, `${caminho}${SUFIXO}`);
      renomeados.push(caminho);
    }
  } catch (erro) {
    for (const caminho of renomeados.reverse()) {
      try {
        renameSync(`${caminho}${SUFIXO}`, caminho);
      } catch {
        // segue desfazendo os demais
      }
    }
    throw new ErroAplicacao(
      `A conversão dos dados antigos falhou: ${(erro as Error).message.replace(/\.$/, "")}. Os dados originais continuam em dados/.`,
      500,
    );
  }
  return { projetos, arquivos };
}

export function listarDadosAntigosConvertidos(): { itens: { nome: string; caminho: string; bytes: number }[] } {
  const pastaDados = obterOpcoesExecucao().pastaDados;
  if (!existsSync(pastaDados)) return { itens: [] };
  const itens = RENOMEADOS.map((nome) => `${nome}${SUFIXO}`)
    .filter((nome) => existsSync(join(pastaDados, nome)))
    .map((nome) => {
      const caminho = join(pastaDados, nome);
      const bytes = statSync(caminho).isDirectory() ? medirPasta(caminho).bytes : statSync(caminho).size;
      return { nome, caminho, bytes };
    });
  return { itens };
}

export function apagarDadosAntigosConvertidos(): void {
  const { itens } = listarDadosAntigosConvertidos();
  if (itens.length === 0) throw new ErroAplicacao("Não há dados antigos para apagar", 404);
  for (const item of itens) rmSync(item.caminho, { recursive: true, force: true });
}
