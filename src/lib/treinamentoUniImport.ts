import { readSheet } from 'read-excel-file/browser';
import { Treinamento } from '../types';
import { normalizeKey, durationHours, normalizeTrainingType, ImportableTreinamento } from './spreadsheetImport';
import { cleanText, dateFromValue, formatDateBR } from '../utils/date';
import { MONTHS_FULL } from '../constants/hr';

/**
 * Import da planilha "Monitoramento Treinamentos" da UNIVERSIDADE.
 * Formato: uma ABA por ANO (2024, 2025, 2026…), colunas Data, Mês referência,
 * Tema, Tipo, Facilitador, Público, Unidade (campus), Hora, Carga horária,
 * Quant pessoas previstas/realizadas, Total horas de formação, Valor investido.
 *
 * Cuidados específicos deste arquivo:
 * - À direita há colunas de RESUMO com cabeçalhos repetidos ("Valor investido" 2×) —
 *   por isso o leitor local mantém só a PRIMEIRA ocorrência de cada coluna.
 * - O mesmo tema roda em SESSÕES no mesmo dia (Hora diferente) → o código estável
 *   (hash) inclui a hora, e cada sessão vira um registro.
 */

const ANOS_CANDIDATOS = ['2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030'];

// Rótulo de campus na planilha → nome canônico da sede no sistema.
const CAMPUS_PARA_SEDE: Record<string, string> = {
  'eusebio': 'EUSEBIO',
  'aldeota': 'ALDEOTA',
  'dom luis': 'DOM LUÍS',
  'parque ecologico': 'PARQUE ECOLÓGICO',
  'parquelandia': 'PARQUELANDIA 3',
  'pql': 'PARQUELANDIA 3',
  'benfica': 'UNIBENFICA',
  'pe': 'PARQUE ECOLÓGICO',
  'cesiu': 'ALDEOTA',
  'cvu': 'ALDEOTA',
};

function resolverCampus(valor: unknown): string {
  const chave = normalizeKey(valor);
  if (CAMPUS_PARA_SEDE[chave]) return CAMPUS_PARA_SEDE[chave];
  // fallback por conteúdo: "Clinica Escola CESIU" contém "cesiu" → ALDEOTA
  for (const [apelido, sede] of Object.entries(CAMPUS_PARA_SEDE)) {
    if (apelido.length >= 3 && chave.includes(apelido)) return sede;
  }
  return cleanText(valor) || 'Universidade';
}

/** Hash estável (DJB2) → código inteiro positivo (re-importar não duplica). */
function hashCodigo(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0x7fffffff;
  return h;
}

/** "Hora" da planilha (excel-time) → texto "HH:MM"; '' se vazio/inválido.
 *  Lê em UTC: a lib ancora o horário de parede em UTC (ler local desloca o fuso). */
function horaTexto(valor: unknown): string {
  const d = dateFromValue(valor);
  if (d && d.getUTCFullYear() <= 1901) {
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
  const t = cleanText(valor);
  return /^\d{1,2}:\d{2}/.test(t) ? t : '';
}

/** Lê uma aba mantendo só a PRIMEIRA ocorrência de cada cabeçalho (ignora colunas de resumo repetidas). */
async function rowsPrimeiraOcorrencia(file: File, aba: string): Promise<Record<string, unknown>[]> {
  let matrix: unknown[][];
  try { matrix = await readSheet(file, aba); } catch { return []; }
  const headerIdx = matrix.findIndex(row => row.some(cell => cleanText(cell)));
  if (headerIdx < 0) return [];
  const mapa: Record<string, number> = {};
  matrix[headerIdx].forEach((h, i) => {
    const k = normalizeKey(h);
    if (k && !(k in mapa)) mapa[k] = i; // só a 1ª ocorrência
  });
  return matrix.slice(headerIdx + 1)
    .filter(row => row.some(cell => cleanText(cell)))
    .map(row => {
      const rec: Record<string, unknown> = {};
      Object.entries(mapa).forEach(([k, i]) => { rec[k] = row[i] ?? null; });
      return rec;
    });
}

export async function parseTreinamentosUniversidade(file: File): Promise<{ treinamentos: ImportableTreinamento[]; warnings: string[] }> {
  const warnings: string[] = [];
  const out: ImportableTreinamento[] = [];

  for (const ano of ANOS_CANDIDATOS) {
    const rows = await rowsPrimeiraOcorrencia(file, ano);
    if (!rows.length) continue;

    rows.forEach((row, i) => {
      const tema = cleanText(row['tema']);
      if (!tema) { warnings.push(`Aba ${ano}, linha ${i + 2}: ignorada (sem tema).`); return; }

      const dataInicio = formatDateBR(row['data']);
      const unidade = resolverCampus(row['unidade']);
      const hora = horaTexto(row['hora']);
      const cargaHoraria = durationHours(row['carga horaria']);
      const qtdPrevista = Number(row['quant pessoas previstas']) || 0;
      const qtdRealizada = Number(row['quant pessoas realizadas']) || 0;
      const totalHoras = durationHours(row['total horas de formacao']) || Number((qtdRealizada * cargaHoraria).toFixed(2));

      out.push({
        codigo: hashCodigo([tema, dataInicio, unidade, hora, qtdPrevista, qtdRealizada].join('|')),
        dataInicio,
        dataTermino: undefined,
        mesReferencia: cleanText(row['mes referencia']).toLowerCase() || MONTHS_FULL[new Date().getMonth()],
        tema,
        tipo: normalizeTrainingType(row['tipo']),
        facilitador: cleanText(row['facilitador']) || 'RH Universidade',
        publico: cleanText(row['publico']),
        unidade,
        hora,
        cargaHoraria,
        qtdPrevista,
        qtdRealizada,
        totalHorasFormacao: totalHoras,
        valorInvestido: Number(row['valor investido']) || 0,
      });
    });
  }

  if (!out.length) warnings.push('Nenhuma aba de ano (2023–2030) com dados foi encontrada.');
  return { treinamentos: out, warnings };
}
