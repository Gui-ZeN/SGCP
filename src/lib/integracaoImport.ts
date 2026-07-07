import { Integracao } from '../types';
import { worksheetRows } from './spreadsheetImport';
import { cleanText, formatDateBR } from '../utils/date';

/**
 * Import da planilha "Treinamento de integração" da UNIVERSIDADE.
 * Formato: uma ABA por campus, colunas Nome, Função, Setor, Admissão, Supervisor,
 * Integração (Realizado/Não realizado), Data, Responsável, Contato, Observação.
 */

export type ImportableIntegracao = Omit<Integracao, 'id'>;

// Aba da planilha → nome canônico da sede no sistema (Painel Admin).
// "Benfica" da Universidade aponta para a sede híbrida UNIBENFICA.
const ABA_PARA_SEDE: Record<string, string> = {
  'Parquelândia': 'PARQUELANDIA 3',
  'Parque Ecológico': 'PARQUE ECOLÓGICO',
  'Aldeota': 'ALDEOTA',
  'Benfica': 'UNIBENFICA',
  'Dom Luis': 'DOM LUÍS',
  'Eusébio': 'EUSEBIO',
};

function normalizeStatusIntegracao(statusRaw: unknown, dataRaw: unknown): Integracao['status'] {
  const data = cleanText(dataRaw).toLowerCase();
  if (data.includes('deslig')) return 'Desligado'; // a planilha marca "Desligado" na coluna Data
  const s = cleanText(statusRaw).toLowerCase();
  if (s.includes('deslig')) return 'Desligado';
  if (s.startsWith('real') || s.includes('sim')) return 'Realizado';
  return 'Não realizado';
}

export async function parseIntegracoes(file: File): Promise<{ integracoes: ImportableIntegracao[]; warnings: string[] }> {
  const warnings: string[] = [];
  const out: ImportableIntegracao[] = [];

  for (const [aba, sede] of Object.entries(ABA_PARA_SEDE)) {
    const rows = await worksheetRows(file, aba); // aba ausente → []
    if (!rows.length) { warnings.push(`Aba "${aba}" vazia ou não encontrada.`); continue; }

    rows.forEach((row, i) => {
      const nome = cleanText(row['nome']);
      if (!nome) { warnings.push(`${aba} linha ${i + 2}: ignorada (sem nome).`); return; }
      const status = normalizeStatusIntegracao(row['integracao'], row['data']);
      const dataTxt = cleanText(row['data']);
      out.push({
        nome,
        funcao: cleanText(row['funcao']),
        setor: cleanText(row['setor']),
        sede,
        admissao: formatDateBR(row['admissao']),
        supervisor: cleanText(row['supervisor']),
        status,
        dataIntegracao: status === 'Desligado' ? '' : dataTxt,
        responsavel: cleanText(row['responsavel']),
        contato: cleanText(row['contato']),
        observacao: cleanText(row['observacao']),
      });
    });
  }
  return { integracoes: out, warnings };
}
