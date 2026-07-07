import { readSheet } from 'read-excel-file/browser';
import { Experiencia } from '../types';
import { normalizeKey } from './spreadsheetImport';
import { cleanText, formatDateBR } from '../utils/date';

/**
 * Import da planilha "Acompanhamento do período de experiência GERAL" da
 * UNIVERSIDADE. Formato: uma ABA por campus; colunas Nome, Função, [Unidade],
 * Admissão, "1º Período 45 dias" (data), Supervisor, APE, "2º Período 75 dias"
 * (data), APE, Responsável, Observação.
 *
 * Cuidados específicos:
 * - O cabeçalho "APE" aparece DUAS vezes (avaliação do 1º e do 2º período) —
 *   o leitor guarda TODAS as ocorrências, por posição.
 * - Os términos são gravados COMO ESTÃO na planilha (lá o 2º período é 75 dias;
 *   o padrão do Colégio é 90) — não recalculamos.
 * - Status derivado (heurística): APE com "prorrog" → PRORROGADO; "deslig"/
 *   "encerr" → ENCERRADO; senão, período ainda corrente → EM_ANALISE, período
 *   já vencido → EFETIVADO. As APEs cruas vão para as observações (nada se perde).
 */

const ABA_PARA_SEDE: Record<string, string> = {
  'Aldeota': 'ALDEOTA',
  'Parquelândia': 'PARQUELANDIA 3',
  'Benfica': 'UNIBENFICA',
  'Dom Luís': 'DOM LUÍS',
  'Parque Ecológico': 'PARQUE ECOLÓGICO',
  'Eusébio': 'EUSEBIO',
};

type Linha = { first: (k: string) => unknown; all: (k: string) => unknown[] };

/** Lê uma aba preservando TODAS as ocorrências de cada cabeçalho (posicional). */
async function lerAba(file: File, aba: string): Promise<Linha[]> {
  let matrix: unknown[][];
  try { matrix = await readSheet(file, aba); } catch { return []; }
  const headerIdx = matrix.findIndex(row => row.some(cell => cleanText(cell)));
  if (headerIdx < 0) return [];
  const posicoes: Record<string, number[]> = {};
  matrix[headerIdx].forEach((h, i) => {
    const k = normalizeKey(h);
    if (k) (posicoes[k] = posicoes[k] || []).push(i);
  });
  const chavePorPrefixo = (prefixo: string) =>
    Object.keys(posicoes).find(k => k.startsWith(prefixo));
  return matrix.slice(headerIdx + 1)
    .filter(row => row.some(cell => cleanText(cell)))
    .map(row => ({
      first: (k: string) => { const key = posicoes[k] ? k : chavePorPrefixo(k); return key ? row[posicoes[key][0]] : null; },
      all: (k: string) => { const key = posicoes[k] ? k : chavePorPrefixo(k); return key ? posicoes[key].map(i => row[i]) : []; },
    }));
}

// Valores reais de APE na planilha: "Não realizado", "Prorrogar", "Efetivar", "Desligar".
// A decisão FINAL é a mais recente: olha o APE do 2º período antes do 1º (quem
// prorrogou aos 45 e efetivou aos 75 é EFETIVADO, não PRORROGADO).
function statusDe(apes: string[], termino2BR: string): Experiencia['status'] {
  for (const ape of [...apes].reverse()) {
    const a = ape.toLowerCase();
    if (a.includes('efetiv')) return 'EFETIVADO';
    if (a.includes('deslig') || a.includes('encerr')) return 'ENCERRADO';
    if (a.includes('prorrog')) return 'PRORROGADO';
  }
  // Sem sinal explícito ("Não realizado"/vazio): corrente → em análise; vencido →
  // efetivado (heurística — o acompanhamento acabou sem registro de saída).
  const [d, m, a] = termino2BR.split('/').map(Number);
  if (a && new Date(a, (m || 1) - 1, d || 1) >= new Date()) return 'EM_ANALISE';
  return 'EFETIVADO';
}

export async function parseExperienciasUniversidade(file: File): Promise<{ experiencias: Omit<Experiencia, 'id'>[]; warnings: string[] }> {
  const warnings: string[] = [];
  const out: Omit<Experiencia, 'id'>[] = [];

  for (const [aba, sede] of Object.entries(ABA_PARA_SEDE)) {
    const linhas = await lerAba(file, aba);
    if (!linhas.length) { warnings.push(`Aba "${aba}" vazia ou não encontrada.`); continue; }

    linhas.forEach((l, i) => {
      const colaborador = cleanText(l.first('nome'));
      if (!colaborador) { warnings.push(`${aba} linha ${i + 2}: ignorada (sem nome).`); return; }

      const termino1 = formatDateBR(l.first('1 periodo'));
      const termino2 = formatDateBR(l.first('2 periodo'));
      const apes = l.all('ape').map(v => cleanText(v));
      const obsPartes = [
        cleanText(l.first('observacao')),
        apes[0] && `APE 1º período: ${apes[0]}`,
        apes[1] && `APE 2º período: ${apes[1]}`,
        cleanText(l.first('responsavel')) && `Responsável APE: ${cleanText(l.first('responsavel'))}`,
      ].filter(Boolean);

      out.push({
        colaborador,
        funcao: cleanText(l.first('funcao')),
        setor: cleanText(l.first('unidade')) || '',
        sede,
        dataAdmissao: formatDateBR(l.first('admissao')),
        supervisor: cleanText(l.first('supervisor')),
        observacoes: obsPartes.join('\n'),
        status: statusDe(apes, termino2),
        termino1,
        termino2,
      });
    });
  }
  return { experiencias: out, warnings };
}
