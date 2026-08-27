import { Selecao } from '../types';
import { normalizeKey, numberValue } from './spreadsheetImport';
import { cleanText, formatDateBR } from '../utils/date';
import { lerAbaComCabecalho, listarAbas } from './planilhaUtils';

export { listarAbas };

/**
 * Importação das abas "QUANTI" da planilha de Seleções.
 *
 * Cada linha é um DIA DE SELEÇÃO numa sede — não uma vaga. A tentativa de casar
 * com vagas foi medida e descartada: 89 eventos pedagógicos para 17 vagas, 56
 * com cargo genérico "Professor(a)", zero coincidindo com a data de uma
 * solicitação, e 77 de 89 casando com VÁRIAS vagas ao abrir a janela para 90
 * dias. Ambiguidade não é vínculo. Por isso entram como agregado.
 *
 * Duas abas com formatos parecidos, mas não iguais:
 *  - "QUANTI SELEÇÃO GERAL": CARGO, SEDE, DATA + CONTRATADOS + 10 colunas de
 *    motivo de desistência discriminado.
 *  - "QUANTI PEDAGÓGICO": DATA, CARGO, SEDE (ordem trocada), SEM contratados e
 *    com um único campo de motivo em texto livre.
 * A leitura é por NOME de coluna, então a ordem não importa e a ausência de
 * `CONTRATADOS` vira 0.
 */

/** Colunas que não são motivo de desistência — o resto do cabeçalho é. */
const COLUNAS_FIXAS = [
  'cargo', 'sede', 'data', 'responsável rh', 'convocados', 'compareceram',
  'ausentes', 'contratados', 'desistiram', 'motivo da desistencia',
].map(normalizeKey);

export interface SelecaoImportada extends Omit<Selecao, 'id'> {}

export interface ResumoSelecoes {
  selecoes: SelecaoImportada[];
  ignoradas: string[];
  /** Linhas em que convocados ≠ compareceram + ausentes (ver `taxaComparecimento`). */
  inconsistentes: number;
}

/** A aba é uma das "QUANTI"? Usado para filtrar o dropdown. */
export function ehAbaQuanti(nome: string): boolean {
  return normalizeKey(nome).includes(normalizeKey('quanti'));
}

/** Deduz a origem pelo nome da aba; usada para separar os dois funis. */
export function origemDaAba(nome: string): Selecao['origem'] {
  return normalizeKey(nome).includes(normalizeKey('pedagogico')) ? 'pedagogico' : 'geral';
}

export async function parseSelecoes(file: File, aba: string): Promise<ResumoSelecoes> {
  const { registros, primeiraLinha, cabecalho } = await lerAbaComCabecalho(file, aba, ['cargo', 'sede', 'data']);
  const origem = origemDaAba(aba);
  const selecoes: SelecaoImportada[] = [];
  const ignoradas: string[] = [];
  let inconsistentes = 0;

  // Tudo que não é coluna fixa e tem cabeçalho vira motivo de desistência.
  const colunasDeMotivo = cabecalho.filter(c => c && !COLUNAS_FIXAS.includes(c));

  registros.forEach((linha, i) => {
    const nLinha = primeiraLinha + i;
    const cargo = cleanText(linha[normalizeKey('cargo')]);
    const data = formatDateBR(linha[normalizeKey('data')]);

    const convocados = numberValue(linha[normalizeKey('convocados')]);
    const compareceram = numberValue(linha[normalizeKey('compareceram')]);
    const ausentes = numberValue(linha[normalizeKey('ausentes')]);
    const contratados = numberValue(linha[normalizeKey('contratados')]);

    // Linha sem cargo, sem data e sem número nenhum é resíduo de arrastar
    // fórmula — na aba Geral são 235 linhas com só um `0` solto em DESISTIRAM.
    // Descartar em silêncio: listá-las como "ignoradas" afogaria os avisos que
    // o RH precisa ver de verdade.
    const vazia = !cargo && !data && convocados + compareceram + ausentes + contratados === 0;
    if (vazia) return;

    if (!cargo) { ignoradas.push(`linha ${nLinha}: sem cargo`); return; }
    if (!data) { ignoradas.push(`linha ${nLinha}: "${cargo}" sem data`); return; }
    if (convocados !== compareceram + ausentes) inconsistentes++;

    const motivos: Record<string, number> = {};
    colunasDeMotivo.forEach(col => {
      const n = numberValue(linha[col]);
      if (n > 0) motivos[col] = n;
    });

    selecoes.push({
      data,
      cargo,
      sede: cleanText(linha[normalizeKey('sede')]),
      responsavel: cleanText(linha[normalizeKey('responsável rh')]),
      origem,
      convocados,
      compareceram,
      ausentes,
      contratados, // coluna ausente no pedagógico → 0
      desistiram: numberValue(linha[normalizeKey('desistiram')]),
      ...(Object.keys(motivos).length ? { motivos } : {}),
    });
  });

  return { selecoes, ignoradas, inconsistentes };
}

/** Chave de deduplicação: um evento é (data, cargo, sede, origem). */
function chave(s: Pick<Selecao, 'data' | 'cargo' | 'sede' | 'origem'>): string {
  return `${s.data}|${s.cargo.trim().toLowerCase()}|${s.sede.trim().toLowerCase()}|${s.origem}`;
}

/**
 * Separa o que entra do que já existe. Dedup por CONTAGEM, mesma razão do
 * importador de vagas: nada garante que a combinação seja única.
 */
export function planejarSelecoes(
  candidatas: SelecaoImportada[],
  existentes: Pick<Selecao, 'data' | 'cargo' | 'sede' | 'origem'>[]
): { aImportar: SelecaoImportada[]; jaExistem: number } {
  const saldo = new Map<string, number>();
  existentes.forEach(e => {
    const k = chave(e);
    saldo.set(k, (saldo.get(k) || 0) + 1);
  });

  const aImportar: SelecaoImportada[] = [];
  let jaExistem = 0;

  candidatas.forEach(c => {
    const k = chave(c);
    const restante = saldo.get(k) || 0;
    if (restante > 0) { saldo.set(k, restante - 1); jaExistem++; return; }
    aImportar.push(c);
  });

  return { aImportar, jaExistem };
}
