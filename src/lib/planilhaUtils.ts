import readXlsxFile, { readSheet } from 'read-excel-file/browser';
import { normalizeKey } from './spreadsheetImport';
import { cleanText } from '../utils/date';

/**
 * Leitura de planilhas com ABA ESCOLHIDA pelo usuário — base dos importadores
 * de vagas anuais e de seleções.
 *
 * O que este módulo resolve, e que o `worksheetRows` genérico não resolvia: a
 * linha de cabeçalho é achada pelo CONTEÚDO, não por "primeira linha não
 * vazia". A aba 2026 do Controle de Vagas tem um lembrete solto na 1ª linha
 * ("Usar planilha do DASHBOARD") e as QUANTI da planilha de Seleções trazem uma
 * linha de totais antes do cabeçalho — nos dois casos, adotar a primeira linha
 * preenchida faz o parser ler zero registros.
 */

/**
 * Nomes das abas, na ordem do arquivo.
 *
 * O export default do `read-excel-file` v9 devolve `{ sheet, data }[]`: o nome
 * está em `sheet`. A opção `getSheets` das versões antigas não existe mais, e
 * `name` volta `null` — foi o que deixou o dropdown de abas vazio.
 */
export async function listarAbas(file: File): Promise<string[]> {
  try {
    const sheets = await readXlsxFile(file);
    return (sheets as unknown as { sheet: string }[])
      .map(s => s.sheet)
      .filter((nome): nome is string => typeof nome === 'string' && nome.length > 0);
  } catch {
    return [];
  }
}

export interface AbaLida {
  registros: Record<string, unknown>[];
  /** Número da 1ª linha de dados na planilha (1-based), para avisos conferíveis. */
  primeiraLinha: number;
  /** Cabeçalho normalizado, na ordem das colunas. */
  cabecalho: string[];
}

/**
 * Lê uma aba e devolve as linhas como objetos indexados pelo cabeçalho
 * normalizado.
 *
 * @param colunasEsperadas nomes de colunas que identificam o cabeçalho; a
 *        primeira linha que contiver ao menos DUAS delas é adotada. Duas, e não
 *        todas, para tolerar abas que não trazem o conjunto completo.
 */
export async function lerAbaComCabecalho(
  file: File,
  aba: string,
  colunasEsperadas: string[]
): Promise<AbaLida> {
  const vazio: AbaLida = { registros: [], primeiraLinha: 0, cabecalho: [] };

  let matriz: unknown[][];
  try {
    matriz = (await readSheet(file, aba)) as unknown[][];
  } catch {
    return vazio;
  }

  const esperadas = colunasEsperadas.map(normalizeKey);
  const iCabecalho = matriz.findIndex(linha =>
    linha.map(normalizeKey).filter(c => esperadas.includes(c)).length >= 2
  );
  if (iCabecalho < 0) return vazio;

  const cabecalho = matriz[iCabecalho].map(normalizeKey);
  const registros = matriz.slice(iCabecalho + 1)
    .filter(linha => linha.some(celula => cleanText(celula)))
    .map(linha => {
      const registro: Record<string, unknown> = {};
      cabecalho.forEach((coluna, i) => { if (coluna) registro[coluna] = linha[i] ?? null; });
      return registro;
    });

  return { registros, primeiraLinha: iCabecalho + 2, cabecalho };
}
