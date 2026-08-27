import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mesmo esquema do teste de vagas: matrizes fixas no lugar do arquivo. O mock do
// export default devolve `{ sheet, data }`, que é a FORMA REAL da v9 da lib —
// uma versão anterior usava `{ name }`, o teste passava e o dropdown de abas
// abria vazio na tela.
const matrizes: Record<string, unknown[][]> = {};
const ordemDasAbas: string[] = [];

vi.mock('read-excel-file/browser', () => ({
  default: vi.fn(async () => ordemDasAbas.map(sheet => ({ sheet, data: matrizes[sheet] || [] }))),
  readSheet: vi.fn(async (_file: unknown, aba: string) => {
    if (!(aba in matrizes)) throw new Error('aba inexistente');
    return matrizes[aba];
  }),
}));

const { parseSelecoes, planejarSelecoes, ehAbaQuanti, origemDaAba, listarAbas } =
  await import('./selecoesImport');

const arquivo = {} as File;
const data = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));

// Cabeçalho da aba "QUANTI SELEÇÃO GERAL": CARGO primeiro, com CONTRATADOS.
const CAB_GERAL = ['CARGO', 'SEDE', 'DATA', 'RESPONSÁVEL RH', 'CONVOCADOS', 'COMPARECERAM',
                   'AUSENTES', 'CONTRATADOS', 'DESISTIRAM', 'Local de trabalho distante',
                   'Sem interesse na vaga'];

// Cabeçalho da "QUANTI PEDAGÓGICO": DATA primeiro, SEM contratados.
const CAB_PEDAG = ['DATA', 'CARGO', 'SEDE', 'RESPONSÁVEL RH', 'CONVOCADOS', 'COMPARECERAM',
                   'AUSENTES', 'DESISTIRAM', 'MOTIVO DA DESISTENCIA'];

beforeEach(() => {
  for (const k of Object.keys(matrizes)) delete matrizes[k];
  ordemDasAbas.length = 0;
});

describe('ehAbaQuanti / origemDaAba', () => {
  it('reconhece só as abas de totais', () => {
    expect(ehAbaQuanti('QUANTI SELEÇÃO GERAL 2026')).toBe(true);
    expect(ehAbaQuanti('QUANTI PEDAGÓGICO 2026')).toBe(true);
    // As nominais têm nome de candidato e não entram no sistema.
    expect(ehAbaQuanti('GERAL 2026')).toBe(false);
    expect(ehAbaQuanti('PEDAGÓGICO 2026')).toBe(false);
  });

  it('separa os dois funis pelo nome da aba', () => {
    expect(origemDaAba('QUANTI PEDAGÓGICO 2026')).toBe('pedagogico');
    expect(origemDaAba('QUANTI SELEÇÃO GERAL 2026')).toBe('geral');
  });

  it('lista as abas do arquivo', async () => {
    ordemDasAbas.push('PEDAGÓGICO 2026', 'QUANTI PEDAGÓGICO 2026');
    expect(await listarAbas(arquivo)).toEqual(['PEDAGÓGICO 2026', 'QUANTI PEDAGÓGICO 2026']);
  });
});

describe('parseSelecoes', () => {
  it('lê a aba Geral, pulando a linha de totais que vem antes do cabeçalho', async () => {
    matrizes['QUANTI SELEÇÃO GERAL 2026'] = [
      [null, null, null, 'Total:', 754, 244, 413, 58, 79, null, null],  // linha de totais
      CAB_GERAL,
      ['Estoquista', 'CD', data(2026, 1, 6), 'Arlana', 11, 2, 6, 1, 3, 2, 1],
    ];

    const { selecoes, ignoradas } = await parseSelecoes(arquivo, 'QUANTI SELEÇÃO GERAL 2026');

    expect(ignoradas).toHaveLength(0);
    expect(selecoes).toHaveLength(1);
    expect(selecoes[0]).toMatchObject({
      data: '06/01/2026',
      cargo: 'Estoquista',
      sede: 'CD',
      responsavel: 'Arlana',
      origem: 'geral',
      convocados: 11,
      compareceram: 2,
      ausentes: 6,
      contratados: 1,
      desistiram: 3,
    });
  });

  it('captura os motivos de desistência como colunas dinâmicas', async () => {
    matrizes['QUANTI SELEÇÃO GERAL 2026'] = [
      CAB_GERAL,
      ['Estoquista', 'CD', data(2026, 1, 6), 'Arlana', 11, 2, 6, 1, 3, 2, 0],
    ];

    const { selecoes } = await parseSelecoes(arquivo, 'QUANTI SELEÇÃO GERAL 2026');

    // Só motivo com quantidade > 0 entra; coluna zerada é ruído.
    expect(Object.values(selecoes[0].motivos || {})).toEqual([2]);
  });

  it('lê a aba Pedagógica, que tem a ordem trocada e não tem CONTRATADOS', async () => {
    matrizes['QUANTI PEDAGÓGICO 2026'] = [
      [null, null, null, 'TOTAL:', 256, 118, 120, 28],
      CAB_PEDAG,
      [data(2026, 1, 13), 'Professor(a)', 'Benfica', 'Diana', 5, 5, 0, 0, ''],
    ];

    const { selecoes } = await parseSelecoes(arquivo, 'QUANTI PEDAGÓGICO 2026');

    expect(selecoes[0]).toMatchObject({
      data: '13/01/2026', cargo: 'Professor(a)', sede: 'Benfica',
      origem: 'pedagogico', convocados: 5, compareceram: 5,
    });
    expect(selecoes[0].contratados).toBe(0); // coluna ausente vira 0, não undefined
  });

  it('conta as linhas em que convocados != compareceram + ausentes', async () => {
    matrizes['QUANTI SELEÇÃO GERAL 2026'] = [
      CAB_GERAL,
      ['A', 'DT', data(2026, 2, 1), 'Camila', 11, 2, 6, 0, 0, 0, 0],   // furo: 11 ≠ 8
      ['B', 'DT', data(2026, 2, 2), 'Camila', 10, 4, 6, 0, 0, 0, 0],   // fecha
    ];

    const { inconsistentes } = await parseSelecoes(arquivo, 'QUANTI SELEÇÃO GERAL 2026');
    expect(inconsistentes).toBe(1);
  });

  it('ignora linha sem cargo e sem data, dizendo o porquê', async () => {
    matrizes['QUANTI SELEÇÃO GERAL 2026'] = [
      CAB_GERAL,
      ['', 'DT', data(2026, 2, 1), 'Camila', 1, 1, 0, 0, 0, 0, 0],
      ['Sem data', 'DT', null, 'Camila', 1, 1, 0, 0, 0, 0, 0],
      ['Válida', 'DT', data(2026, 2, 3), 'Camila', 1, 1, 0, 0, 0, 0, 0],
    ];

    const { selecoes, ignoradas } = await parseSelecoes(arquivo, 'QUANTI SELEÇÃO GERAL 2026');

    expect(selecoes.map(s => s.cargo)).toEqual(['Válida']);
    expect(ignoradas[0]).toContain('sem cargo');
    expect(ignoradas[1]).toContain('sem data');
  });
});

describe('parseSelecoes — resíduo de planilha', () => {
  it('descarta em silêncio a linha só com um zero solto (não vira aviso)', async () => {
    matrizes['QUANTI SELEÇÃO GERAL 2026'] = [
      CAB_GERAL,
      ['Válida', 'DT', data(2026, 2, 3), 'Camila', 1, 1, 0, 0, 0, 0, 0],
      [null, null, null, null, null, null, null, null, 0, null, null],  // resíduo
      [null, null, null, null, null, null, null, null, 0, null, null],
    ];

    const { selecoes, ignoradas } = await parseSelecoes(arquivo, 'QUANTI SELEÇÃO GERAL 2026');

    expect(selecoes).toHaveLength(1);
    expect(ignoradas).toHaveLength(0);
  });

  it('mas ainda avisa quando a linha tem números e falta o cargo', async () => {
    matrizes['QUANTI SELEÇÃO GERAL 2026'] = [
      CAB_GERAL,
      [null, 'DT', data(2026, 2, 3), 'Camila', 5, 3, 2, 0, 0, 0, 0],
    ];

    const { ignoradas } = await parseSelecoes(arquivo, 'QUANTI SELEÇÃO GERAL 2026');
    expect(ignoradas).toHaveLength(1);
    expect(ignoradas[0]).toContain('sem cargo');
  });
});

describe('planejarSelecoes', () => {
  const e = (data: string, cargo: string, sede: string, origem: any = 'geral') =>
    ({ data, cargo, sede, origem }) as any;

  it('pula os eventos que já existem', () => {
    const r = planejarSelecoes(
      [e('06/01/2026', 'Estoquista', 'CD'), e('13/01/2026', 'Aprendiz', 'DT')],
      [e('06/01/2026', 'Estoquista', 'CD')]
    );
    expect(r.jaExistem).toBe(1);
    expect(r.aImportar.map(x => x.cargo)).toEqual(['Aprendiz']);
  });

  it('não colapsa eventos repetidos: 2 na planilha, 1 no banco → importa 1', () => {
    const r = planejarSelecoes(
      [e('06/01/2026', 'Estoquista', 'CD'), e('06/01/2026', 'Estoquista', 'CD')],
      [e('06/01/2026', 'Estoquista', 'CD')]
    );
    expect(r.aImportar).toHaveLength(1);
  });

  it('mesma data e cargo em funis diferentes são eventos diferentes', () => {
    const r = planejarSelecoes(
      [e('06/01/2026', 'Professor(a)', 'DT', 'pedagogico')],
      [e('06/01/2026', 'Professor(a)', 'DT', 'geral')]
    );
    expect(r.aImportar).toHaveLength(1);
    expect(r.jaExistem).toBe(0);
  });
});
