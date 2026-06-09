import { readSheet } from 'read-excel-file/browser';
import { Entrevista, Treinamento, Vaga } from '../types';
import { MONTHS_FULL } from '../constants/hr';
import {
  cleanText,
  dateFromValue,
  formatDateBR,
  monthAbbrFromDate,
  yearFromDate
} from '../utils/date';

export type ImportableVaga = Omit<Vaga, 'id'> & { codigo: number };
export type ImportableTreinamento = Omit<Treinamento, 'id'> & { codigo: number };
export type ImportableEntrevista = Omit<Entrevista, 'id'> & { codigo: number };

export interface SpreadsheetImportResult {
  vagas: ImportableVaga[];
  treinamentos: ImportableTreinamento[];
  entrevistas: ImportableEntrevista[];
  warnings: string[];
}

function normalizeKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toLowerCase();
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(cleanText(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function durationHours(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value < 1 ? Number((value * 24).toFixed(2)) : value;
  }

  const date = dateFromValue(value);
  if (date && date.getFullYear() <= 1901) {
    return Number((date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600).toFixed(2));
  }

  const text = cleanText(value);
  const time = text.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (time) {
    return Number((Number(time[1]) + Number(time[2]) / 60 + Number(time[3] || 0) / 3600).toFixed(2));
  }
  return numberValue(value);
}

function normalizeStatus(value: unknown): Vaga['status'] {
  const raw = normalizeKey(value);
  if (raw.includes('fech') || raw.includes('concl')) return 'FECHADA';
  if (raw.includes('paus')) return 'PAUSADA';
  if (raw.includes('susp') || raw.includes('cancel')) return 'SUSPENSA';
  if (raw.includes('doc')) return 'DOCUMENTAÇÃO';
  if (raw.includes('reab')) return 'REABERTA';
  return 'ABERTA';
}

function normalizeSexo(value: unknown): Vaga['sexo'] {
  const raw = normalizeKey(value);
  if (raw.startsWith('fem')) return 'FEMININO';
  if (raw.startsWith('mas')) return 'MASCULINO';
  return 'INDIFERENTE';
}

function normalizeTrainingType(value: unknown): Treinamento['tipo'] {
  const raw = normalizeKey(value);
  if (raw.includes('lider')) return 'Liderança';
  if (raw.includes('integr')) return 'Integração';
  if (raw.includes('oper')) return 'Operacional';
  if (raw.includes('comport')) return 'Comportamental';
  return 'Técnico';
}

function normalizeYesNoMaybe(value: unknown): 'Sim' | 'Não' | 'Talvez' {
  const raw = normalizeKey(value);
  if (raw.startsWith('nao')) return 'Não';
  if (raw.startsWith('talvez')) return 'Talvez';
  return 'Sim';
}

function normalizeLikedWork(value: unknown): 'Sim' | 'Não' | 'Parcialmente' {
  const raw = normalizeKey(value);
  if (raw.startsWith('nao')) return 'Não';
  if (raw.startsWith('parc')) return 'Parcialmente';
  return 'Sim';
}

function rating(value: unknown): number {
  return Math.max(1, Math.min(5, Math.round(numberValue(value, 3))));
}

async function worksheetRows(file: File, sheetName: string): Promise<Record<string, unknown>[]> {
  let matrix: unknown[][];
  try {
    matrix = await readSheet(file, sheetName);
  } catch {
    return [];
  }
  const headerRowIndex = matrix.findIndex(row => row.some(cell => cleanText(cell)));
  if (headerRowIndex < 0) return [];

  const headers = matrix[headerRowIndex].map(normalizeKey);
  return matrix.slice(headerRowIndex + 1)
    .filter(row => row.some(cell => cleanText(cell)))
    .map(row => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index] ?? null;
      });
      return record;
    });
}

function value(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (Object.prototype.hasOwnProperty.call(row, normalized)) return row[normalized];
  }
  return null;
}

async function parseVagas(file: File, warnings: string[]): Promise<ImportableVaga[]> {
  const rows = await worksheetRows(file, 'Controle de Vagas');
  return rows.flatMap((row, index) => {
    const vaga = cleanText(value(row, 'Vaga'));
    const solicitante = cleanText(value(row, 'Solicitante'));
    if (!vaga || !solicitante) {
      warnings.push(`Vaga linha ${index + 2}: ignorada por falta de cargo ou solicitante.`);
      return [];
    }

    const solicitacao = value(row, 'Solicitação');
    const conclusao = value(row, 'Conclusão');
    const motivo = cleanText(value(row, 'Motivo'));

    return [{
      codigo: Math.trunc(numberValue(value(row, 'Código'), 1000 + index)),
      vaga,
      sede: cleanText(value(row, 'Sede')) || 'DT',
      status: normalizeStatus(value(row, 'Status')),
      setor: cleanText(value(row, 'Setor')) || 'Geral',
      sexo: normalizeSexo(value(row, 'Sexo')),
      solicitacao: formatDateBR(solicitacao) || formatDateBR(new Date()),
      solicitante,
      motivo,
      funcionarioSubstituido: cleanText(value(row, 'Funcionário a ser substituído')),
      aprovado: cleanText(value(row, 'Aprovado')),
      observacoes: cleanText(value(row, 'Observações')),
      responsavel: cleanText(value(row, 'Responsável')) || 'RH',
      conclusao: formatDateBR(conclusao),
      tempoProcesso: numberValue(value(row, 'Tempo do processo')),
      mesSolicitacao: monthAbbrFromDate(solicitacao),
      mesConclusao: monthAbbrFromDate(conclusao),
      categoria: 'Importado',
      tempoSla: numberValue(value(row, 'Tempo do processo')),
      ano: yearFromDate(solicitacao),
      categoriaMotivo: motivo.toLowerCase().includes('aumento') ? 'Aumento de Quadro' : 'Substituição'
    }];
  });
}

async function parseTreinamentos(file: File, warnings: string[]): Promise<ImportableTreinamento[]> {
  const rows = await worksheetRows(file, 'Controle de Treinamentos');
  return rows.flatMap((row, index) => {
    const tema = cleanText(value(row, 'Tema'));
    if (!tema) {
      warnings.push(`Treinamento linha ${index + 2}: ignorado por falta de tema.`);
      return [];
    }

    const cargaHoraria = durationHours(value(row, 'Carga horária'));
    const qtdRealizada = numberValue(value(row, 'Quant pessoas realizadas'));

    return [{
      codigo: Math.trunc(numberValue(value(row, 'Código'), 101 + index)),
      dataInicio: formatDateBR(value(row, 'Data início')),
      dataTermino: undefined,
      mesReferencia: cleanText(value(row, 'Mês referência')).toLowerCase() || MONTHS_FULL[new Date().getMonth()],
      tema,
      tipo: normalizeTrainingType(value(row, 'Tipo')),
      facilitador: cleanText(value(row, 'Área / Facilitador')) || 'RH',
      publico: cleanText(value(row, 'Público')),
      unidade: cleanText(value(row, 'Unidade')) || 'DT',
      cargaHoraria,
      qtdPrevista: numberValue(value(row, 'Quant pessoas previstas')),
      qtdRealizada,
      totalHorasFormacao: durationHours(value(row, 'Total horas de formação')) || Number((qtdRealizada * cargaHoraria).toFixed(2)),
      valorInvestido: 0
    }];
  });
}

async function parseEntrevistas(file: File, warnings: string[]): Promise<ImportableEntrevista[]> {
  const rows = await worksheetRows(file, 'Entrevistas Desligamento');
  return rows.flatMap((row, index) => {
    const colaborador = cleanText(value(row, 'Nome completo'));
    const funcao = cleanText(value(row, 'Função'));
    if (!colaborador || !funcao) {
      warnings.push(`Entrevista linha ${index + 2}: ignorada por falta de colaborador ou função.`);
      return [];
    }

    const motivo = cleanText(value(row, 'Por quais motivos está saindo da empresa?'));
    const detalhes = cleanText(value(row, 'Detalhes'));

    return [{
      codigo: 301 + index,
      colaborador,
      dataEntrevista: formatDateBR(value(row, 'Data')) || formatDateBR(new Date()),
      funcao,
      unidade: cleanText(value(row, 'Unidade')) || 'DT',
      admissao: formatDateBR(value(row, 'Admissão')),
      desligamento: formatDateBR(value(row, 'Desligamento')),
      motivoSaida: detalhes ? `${motivo}: ${detalhes}` : motivo || 'Não informado',
      gostavaTrabalho: normalizeLikedWork(value(row, 'Você gostava de seu trabalho?')),
      oqMaisGostava: cleanText(value(row, 'O que você mais gostava em seu trabalho?')),
      oqMenosGostava: cleanText(value(row, 'O que você menos gostava em seu trabalho?')),
      notaSalario: rating(value(row, 'Quanto você estava satisfeito com seu salário?')),
      notaTreinamento: rating(value(row, 'Quanto você estava satisfeito com os treinamentos?')),
      notaCrescimento: rating(value(row, 'Quanto você estava satisfeito com as oportunidades de crescimento?')),
      notaRelacionamentoColegas: rating(value(row, 'Como era seu relacionamento com os colegas de trabalho?')),
      notaRelacionamentoChefia: rating(value(row, 'Como era seu relacionamento com sua chefia?')),
      notaClimaOrg: rating(value(row, 'Como você considera o clima da organização?')),
      voltaria: normalizeYesNoMaybe(value(row, 'Voltaria a trabalhar conosco?')),
      sugestoes: cleanText(value(row, 'Sugestões para o futuro:')),
      entrevistador: cleanText(value(row, 'Entrevistador')) || 'RH'
    }];
  });
}

export async function parseSgpcSpreadsheet(file: File): Promise<SpreadsheetImportResult> {
  const warnings: string[] = [];
  const [vagas, treinamentos, entrevistas] = await Promise.all([
    parseVagas(file, warnings),
    parseTreinamentos(file, warnings),
    parseEntrevistas(file, warnings)
  ]);

  return {
    vagas,
    treinamentos,
    entrevistas,
    warnings
  };
}
