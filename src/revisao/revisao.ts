import { obterBanco } from "../banco/banco.js";
import { lerUltimaVersaoRoteiro } from "../capitulos/capitulos.js";

// O que está esperando o usuário: roteiros para aprovar e propostas de dossiê prontas.

export interface ItemRevisao {
  tipo: "roteiro_para_aprovar" | "proposta_dossie_pronta";
  projetoId: number;
  capituloNumero: number;
  titulo: string;
  desde: string;
  tarefaId: number | null;
}

interface LinhaCapitulo {
  projeto_id: number;
  slug: string;
  numero: number;
  titulo: string;
}

interface LinhaProposta {
  id: number;
  projeto_id: number;
  capitulo_numero: number;
  titulo: string;
  concluida_em: string;
}

export function listarPendencias(projetoId?: number): ItemRevisao[] {
  const banco = obterBanco();
  const filtro = projetoId === undefined ? "" : "AND c.projeto_id = ?";
  const valores = projetoId === undefined ? [] : [projetoId];

  const roteiros = banco
    .prepare(`
      SELECT c.projeto_id, p.slug, c.numero, c.titulo
      FROM capitulos c JOIN projetos p ON p.id = c.projeto_id
      WHERE c.status = 'roteiro_gerado' ${filtro}
    `)
    .all(...valores) as unknown as LinhaCapitulo[];

  // A proposta mais recente de cada capítulo ainda não aprovado.
  const propostas = banco
    .prepare(`
      SELECT t.id, t.projeto_id, t.capitulo_numero, c.titulo, t.concluida_em
      FROM tarefas t
      JOIN capitulos c ON c.projeto_id = t.projeto_id AND c.numero = t.capitulo_numero
      WHERE t.tipo = 'propor_atualizacao_dossie' AND t.status = 'concluida' AND c.status <> 'aprovado' ${filtro}
        AND t.id = (
          SELECT MAX(t2.id) FROM tarefas t2
          WHERE t2.tipo = t.tipo AND t2.status = 'concluida'
            AND t2.projeto_id = t.projeto_id AND t2.capitulo_numero = t.capitulo_numero
        )
    `)
    .all(...valores) as unknown as LinhaProposta[];

  const itens: ItemRevisao[] = [
    ...roteiros.map((linha) => ({
      tipo: "roteiro_para_aprovar" as const,
      projetoId: linha.projeto_id,
      capituloNumero: linha.numero,
      titulo: linha.titulo,
      desde: lerUltimaVersaoRoteiro(linha.slug, linha.numero)?.criadoEm ?? "",
      tarefaId: null,
    })),
    ...propostas.map((linha) => ({
      tipo: "proposta_dossie_pronta" as const,
      projetoId: linha.projeto_id,
      capituloNumero: linha.capitulo_numero,
      titulo: linha.titulo,
      desde: linha.concluida_em,
      tarefaId: linha.id,
    })),
  ];
  return itens.sort((a, b) => a.desde.localeCompare(b.desde));
}
