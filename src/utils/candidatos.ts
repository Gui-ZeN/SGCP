/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Candidatos de um dia de seleção — as abas nominais da planilha de Seleções
 * ("GERAL 2026", "PEDAGÓGICO 2026") trazidas para o sistema.
 *
 * Os números do dia (convocados, compareceram…) SAEM DA LISTA. Antes o RH
 * lançava o nome numa aba e contava de novo na QUANTI, e as duas não batiam:
 * medido em 23/09/2026 em 120 dias de 2026, "ausentes" só batia em 91 e
 * "compareceram" em 83 — quem desistiu na entrevista entrava ora como
 * ausente, ora não.
 *
 * Decisões de 23/09/2026:
 *  - compareceram = todos menos Ausente (e menos quem ainda está sem resultado);
 *  - desistiu COMPARECEU: veio, e depois desistiu;
 *  - contratação é campo à parte do resultado.
 */
import type { Selecao } from '../types';
import { normalizeKey } from '../lib/spreadsheetImport';

export type ResultadoCandidato =
  | 'convocado' | 'ausente' | 'compareceu' | 'aprovado'
  | 'r_observacao' | 'r_restricao' | 'risco' | 'fora_perfil' | 'desistiu';

export const RESULTADOS: { id: ResultadoCandidato; rotulo: string }[] = [
  { id: 'convocado', rotulo: 'Convocado (sem resultado)' },
  { id: 'ausente', rotulo: 'Ausente' },
  { id: 'compareceu', rotulo: 'Compareceu' },
  { id: 'aprovado', rotulo: 'Aprovado' },
  { id: 'r_observacao', rotulo: 'R. Observação' },
  { id: 'r_restricao', rotulo: 'R. Restrição' },
  { id: 'risco', rotulo: 'Risco' },
  { id: 'fora_perfil', rotulo: 'Fora do perfil' },
  { id: 'desistiu', rotulo: 'Desistiu' },
];

export const rotuloDoResultado = (id: ResultadoCandidato) => RESULTADOS.find(r => r.id === id)?.rotulo || id;

export type Contratacao = 'sim' | 'banco' | 'nao' | '';

export const CONTRATACOES: { id: Contratacao; rotulo: string }[] = [
  { id: '', rotulo: '—' },
  { id: 'sim', rotulo: 'Contratado' },
  { id: 'banco', rotulo: 'Banco' },
  { id: 'nao', rotulo: 'Não contratado' },
];

/** As colunas de motivo da aba QUANTI Geral, na grafia do cabeçalho. */
export const MOTIVOS_DESISTENCIA = [
  'Já está trabalhando / Recebendo seguro',
  'Recebeu uma proposta melhor / Conseguiu outro emprego',
  'Não ter refeição / alimentação',
  'Sem interesse na vaga',
  'Local de trabalho distante',
  'Motivos pessoais',
  'Não compareceu para os testes',
  'Informou que o salário é abaixo do atual / mercado',
  'Não compareceu para admissão / Sem retorno ao RH',
  'Documentação incompleta',
  'Sem disponibilidade para se deslocar entre as sedes',
];

/** O mínimo que o cálculo precisa de cada candidato. */
export interface CandidatoDoDia {
  resultado: ResultadoCandidato;
  contratado?: Contratacao;
  /** Rótulo do motivo, quando desistiu. */
  motivo?: string;
}

export type NumerosDoDia = Pick<Selecao, 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados' | 'status'>
  & { motivos: Record<string, number> };

export function numerosDoDia(candidatos: CandidatoDoDia[]): NumerosDoDia {
  const conta = (f: (c: CandidatoDoDia) => boolean) => candidatos.filter(f).length;
  const motivos: Record<string, number> = {};
  for (const c of candidatos) {
    if (c.resultado !== 'desistiu' || !c.motivo?.trim()) continue;
    // A mesma chave que o import da QUANTI grava — senão o motivo dito no
    // sistema e o importado da planilha virariam duas barras no painel.
    const k = normalizeKey(c.motivo);
    motivos[k] = (motivos[k] || 0) + 1;
  }
  const pendentes = conta(c => c.resultado === 'convocado');
  const ausentes = conta(c => c.resultado === 'ausente');
  return {
    convocados: candidatos.length,
    ausentes,
    compareceram: candidatos.length - ausentes - pendentes,
    desistiram: conta(c => c.resultado === 'desistiu'),
    contratados: conta(c => c.contratado === 'sim'),
    motivos,
    // Um pendente contaria como 0 presente e derrubaria a taxa por algo que só
    // não foi lançado ainda: o dia só entra no funil quando todos têm resultado.
    status: pendentes > 0 ? 'agendado' : 'realizado',
  };
}
