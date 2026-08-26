import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Parser da planilha "Monitoramento Treinamentos" (Universidade): 1 aba por ANO.
 * Duas armadilhas reais do arquivo:
 *  - à direita há colunas de RESUMO que repetem "Valor investido" (só a 1ª vale);
 *  - "Hora" e "Carga horária" vêm como excel-time (época 1899, ancorado em UTC).
 */
const abas: Record<string, unknown[][]> = {};
vi.mock('read-excel-file/browser', () => ({
  readSheet: async (_f: unknown, aba: string) => {
    if (!abas[aba]) throw new Error('sem aba');
    return abas[aba];
  },
}));

const { parseTreinamentosUniversidade } = await import('./treinamentoUniImport');

// cabeçalho fiel: repare no "Valor investido" DUPLICADO (col 12 e col 16)
const CAB = ['Data', 'Mês referência', 'Tema', 'Tipo', 'Facilitador', 'Público', 'Unidade', 'Hora',
             'Carga horária', 'Quant pessoas previstas', 'Quant pessoas realizadas',
             'Total horas de formação', 'Valor investido', null, 'Mês', 'Horas de formação', 'Valor investido'];
const hora = (h: number, m = 0) => new Date(Date.UTC(1899, 11, 30, h, m));
const arquivo = {} as File;
const linha = (tema: string, unidade: string, valor: number, resumo: number) =>
  ['23/02/2026', 'Fevereiro', tema, 'Comportamental', 'Jenifer', 'Geral', unidade,
   hora(13), hora(1), 16, 12, hora(12), valor, null, 'JANEIRO', 999, resumo];

beforeEach(() => { for (const k of Object.keys(abas)) delete abas[k]; });

describe('cabeçalho duplicado', () => {
  it('usa a PRIMEIRA ocorrência de "Valor investido" (ignora a coluna de resumo)', async () => {
    abas['2026'] = [CAB, linha('Relacionamento', 'Eusébio', 2500, 99999)];
    const { treinamentos } = await parseTreinamentosUniversidade(arquivo);
    expect(treinamentos[0].valorInvestido).toBe(2500);
  });
});

describe('excel-time lido em UTC', () => {
  it('13:00 na planilha vira "13:00" (não desloca pelo fuso)', async () => {
    abas['2026'] = [CAB, linha('T', 'Eusébio', 0, 0)];
    const { treinamentos } = await parseTreinamentosUniversidade(arquivo);
    expect(treinamentos[0].hora).toBe('13:00');
    expect(treinamentos[0].cargaHoraria).toBe(1);
  });
});

describe('mapeamento de campus', () => {
  it('resolve por nome, por apelido contido no texto e o Benfica híbrido', async () => {
    abas['2025'] = [CAB,
      linha('A', 'Eusébio', 0, 0),
      linha('B', 'Clinica Escola CESIU', 0, 0),   // apelido dentro do texto
      linha('C', 'Benfica', 0, 0),
      linha('D', 'PQL', 0, 0)];
    const { treinamentos } = await parseTreinamentosUniversidade(arquivo);
    expect(treinamentos.map(t => t.unidade)).toEqual(['EUSEBIO', 'ALDEOTA', 'UNIBENFICA', 'PARQUELANDIA 3']);
  });
});

describe('código estável (re-importar não duplica)', () => {
  it('mesmo conteúdo → mesmo código; conteúdo diferente → código diferente', async () => {
    abas['2026'] = [CAB, linha('Comunicação', 'Eusébio', 0, 0)];
    const a = (await parseTreinamentosUniversidade(arquivo)).treinamentos[0].codigo;
    const b = (await parseTreinamentosUniversidade(arquivo)).treinamentos[0].codigo;
    expect(b).toBe(a);
    abas['2026'] = [CAB, linha('Outro Tema', 'Eusébio', 0, 0)];
    const c = (await parseTreinamentosUniversidade(arquivo)).treinamentos[0].codigo;
    expect(c).not.toBe(a);
  });

  it('sessões do mesmo tema em horários diferentes são registros distintos', async () => {
    const base = linha('Mesmo Tema', 'Eusébio', 0, 0);
    const outraHora = [...base]; outraHora[7] = hora(14);
    abas['2026'] = [CAB, base, outraHora];
    const { treinamentos } = await parseTreinamentosUniversidade(arquivo);
    expect(treinamentos.map(t => t.hora)).toEqual(['13:00', '14:00']);
    expect(treinamentos[0].codigo).not.toBe(treinamentos[1].codigo);
  });
});

describe('robustez', () => {
  it('linha sem tema é ignorada; sem aba de ano avisa', async () => {
    abas['2026'] = [CAB, [null, null, '', 'X', null, null, 'Eusébio', null, null, 0, 0, null, 0, null, null, 0, 0]];
    const r1 = await parseTreinamentosUniversidade(arquivo);
    expect(r1.treinamentos).toHaveLength(0);
    expect(r1.warnings.some(w => w.includes('sem tema'))).toBe(true);

    delete abas['2026'];
    const r2 = await parseTreinamentosUniversidade(arquivo);
    expect(r2.warnings.some(w => w.includes('Nenhuma aba de ano'))).toBe(true);
  });
});
