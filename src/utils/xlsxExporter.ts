/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Exportador .xlsx genérico (write-excel-file/browser). Centraliza o estilo de
 * cabeçalho, a primeira linha fixa e o download (.toFile) usados no relatório de
 * vagas, para reuso nos demais módulos (entrevistas, treinamentos, turnover).
 */

import writeXlsxFile from 'write-excel-file/browser';

export interface XlsxColumn {
  title: string;
  width: number;
}

/** Célula tipada do write-excel-file (type = String/Number/Date; value pode ser null = vazio). */
export interface XlsxCell {
  type?: any;
  value: any;
}

const HEADER_STYLE = {
  fontWeight: 'bold' as const,
  textColor: '#ffffff',
  backgroundColor: '#1e293b',
  align: 'center' as const,
  alignVertical: 'center' as const
};

/**
 * Gera e baixa um .xlsx formatado. `columns` define títulos/larguras; `rows` são
 * as linhas de dados (cada uma um array de células na mesma ordem das colunas).
 * Lança em caso de erro — o chamador trata (toast/alert).
 */
export async function exportToXlsx(
  fileName: string,
  columns: XlsxColumn[],
  rows: XlsxCell[][],
  opts?: { sheet?: string }
): Promise<void> {
  const headerRow = columns.map(c => ({ value: c.title, ...HEADER_STYLE }));
  await writeXlsxFile([headerRow, ...rows] as any, {
    columns: columns.map(c => ({ width: c.width })),
    sheet: opts?.sheet || 'Dados',
    stickyRowsCount: 1
  }).toFile(fileName);
}
