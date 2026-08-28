import { describe, it, expect, vi, beforeEach } from 'vitest';

// Matrizes fixas no lugar do arquivo. O mock do export default devolve
// `{ sheet, data }` — a forma real da v9 da lib.
const matrizes: Record<string, unknown[][]> = {};
const ordemDasAbas: string[] = [];

vi.mock('read-excel-file/browser', () => ({
  default: vi.fn(async () => ordemDasAbas.map(sheet => ({ sheet, data: matrizes[sheet] || [] }))),
  readSheet: vi.fn(async (_file: unknown, aba: string) => {
    if (!(aba in matrizes)) throw new Error('aba inexistente');
    return matrizes[aba];
  }),
}));

const { parseIntegracoesColegio, planejarIntegracoes, ehAbaDeDados } =
  await import('./integracaoColegioImport');

const arquivo = {} as File;
const data = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));

const TITULO = ['Treinamento de Integração', null, null, null, null, null, null];

// Aba "Geral": sede em "Localização/Sede", sem coluna de status.
const CAB_GERAL = ['Nome', 'Data do treinamento', 'Data de Admissão', 'Localização/Sede',
                   'Setor', 'Facilitador', 'Total de pessas integradas'];

// Aba "pedagógico": sede em "Locação / Sede" e com a coluna "Realizada".
const CAB_PEDAG = ['Nome', 'Data do treinamento', 'Data de Admissão', 'Locação / Sede',
                   'Realizada', 'Setor', 'Facilitador'];

beforeEach(() => {
  for (const k of Object.keys(matrizes)) delete matrizes[k];
  ordemDasAbas.length = 0;
});

describe('ehAbaDeDados', () => {
  it('descarta as abas de relatório e a de respostas do formulário', () => {
    expect(ehAbaDeDados('2026 Geral')).toBe(true);
    expect(ehAbaDeDados('2026 pedagógico')).toBe(true);
    expect(ehAbaDeDados('2024')).toBe(true);
    expect(ehAbaDeDados('Relatorio 2026')).toBe(false);
    expect(ehAbaDeDados('Respostas ao formulário 1')).toBe(false);
  });
});

describe('parseIntegracoesColegio', () => {
  it('lê a aba Geral, pulando a linha de título', async () => {
    matrizes['2026 Geral'] = [
      TITULO,
      CAB_GERAL,
      ['Gustavo Pedrosa Silva', data(2026, 1, 5), data(2026, 1, 8), 'KMC2', 'Lojinha', 'Arlana', 51],
    ];

    const { integracoes, ignoradas } = await parseIntegracoesColegio(arquivo, '2026 Geral');

    expect(ignoradas).toHaveLength(0);
    expect(integracoes).toHaveLength(1);
    expect(integracoes[0]).toMatchObject({
      nome: 'Gustavo Pedrosa Silva',
      sede: 'Construtora',   // KMC2 no arquivo; mapeada abaixo

      setor: 'Lojinha',
      admissao: '08/01/2026',
      responsavel: 'Arlana',
      dataIntegracao: '05/01/2026',
      status: 'Realizado',   // aba Geral não tem status: ter data já é o registro
    });
  });

  it('aceita "Locação / Sede" (nome usado nas pedagógicas e em 2024)', async () => {
    matrizes['2026 pedagógico'] = [
      TITULO,
      CAB_PEDAG,
      ['Dálete de Castro', data(2026, 1, 14), data(2026, 1, 20), 'SUL', 'Sim', 'Pedagógico', 'Larissa'],
    ];

    const { integracoes } = await parseIntegracoesColegio(arquivo, '2026 pedagógico');

    expect(integracoes[0].sede).toBe('SUL');
    expect(integracoes[0].setor).toBe('Pedagógico');
    expect(integracoes[0].status).toBe('Realizado');
  });

  it('lê "Realizada = Não" como Não realizado', async () => {
    matrizes['2026 pedagógico'] = [
      TITULO,
      CAB_PEDAG,
      ['Fulana', data(2026, 1, 14), data(2026, 1, 20), 'BS', 'Não', 'Pedagógico', 'Isabelle'],
    ];

    const { integracoes } = await parseIntegracoesColegio(arquivo, '2026 pedagógico');
    expect(integracoes[0].status).toBe('Não realizado');
  });

  it('sem data de treinamento e sem coluna de status, fica Não realizado', async () => {
    matrizes['2026 Geral'] = [
      TITULO,
      CAB_GERAL,
      ['Beltrano', null, data(2026, 3, 1), 'DT', 'TI', 'Arlana', null],
    ];

    const { integracoes } = await parseIntegracoesColegio(arquivo, '2026 Geral');
    expect(integracoes[0].status).toBe('Não realizado');
    expect(integracoes[0].dataIntegracao).toBe('');
  });

  it('ignora linha sem nome, dizendo a linha', async () => {
    matrizes['2026 Geral'] = [
      TITULO,
      CAB_GERAL,
      ['', data(2026, 1, 5), data(2026, 1, 8), 'DT', 'TI', 'Arlana', null],
      ['Válido', data(2026, 1, 6), data(2026, 1, 9), 'DT', 'TI', 'Arlana', null],
    ];

    const { integracoes, ignoradas } = await parseIntegracoesColegio(arquivo, '2026 Geral');

    expect(integracoes.map(i => i.nome)).toEqual(['Válido']);
    expect(ignoradas).toHaveLength(1);
    expect(ignoradas[0]).toContain('sem nome');
  });

  it('não confunde "Total de pessoas integradas" com dado da pessoa', async () => {
    matrizes['2026 Geral'] = [
      TITULO,
      CAB_GERAL,
      ['Primeira', data(2026, 1, 5), data(2026, 1, 8), 'DT', 'TI', 'Arlana', 51],
    ];

    const { integracoes } = await parseIntegracoesColegio(arquivo, '2026 Geral');
    // O 51 é total da planilha; não pode virar campo do registro.
    expect(Object.values(integracoes[0])).not.toContain(51);
  });
});

describe('sedes que não existem no cadastro', () => {
  const comSede = async (sede: string) => {
    matrizes['2026 Geral'] = [
      TITULO,
      CAB_GERAL,
      ['Fulano', data(2026, 1, 5), data(2026, 1, 8), sede, 'TI', 'Arlana', null],
    ];
    const { integracoes } = await parseIntegracoesColegio(arquivo, '2026 Geral');
    return integracoes[0].sede;
  };

  it('KMC2 vira Construtora', async () => expect(await comSede('KMC2')).toBe('Construtora'));
  it('PQL vira PARQUELANDIA 1', async () => expect(await comSede('PQL')).toBe('PARQUELANDIA 1'));
  it('Volante vira DT (era regime de trabalho, não sede)', async () => expect(await comSede('Volante')).toBe('DT'));
  it('Unichristus vira PARQUE ECOLÓGICO', async () => expect(await comSede('Unichristus')).toBe('PARQUE ECOLÓGICO'));

  it('aceita a variação de caixa que existe no arquivo real', async () => {
    expect(await comSede('UNICHRISTUS')).toBe('PARQUE ECOLÓGICO');
    expect(await comSede('volante')).toBe('DT');
  });

  it('sede já cadastrada passa intacta', async () => {
    expect(await comSede('DT')).toBe('DT');
    expect(await comSede('BENFICA')).toBe('BENFICA');
    // Ainda sem decisão do RH: continua como veio, para não sumir do filtro.
    expect(await comSede('BS/ SP/ PN')).toBe('BS/ SP/ PN');
  });
});

describe('planejarIntegracoes', () => {
  const i = (nome: string, sede: string, admissao: string) => ({ nome, sede, admissao }) as any;

  it('pula quem já existe', () => {
    const r = planejarIntegracoes(
      [i('Ana', 'DT', '08/01/2026'), i('Bruno', 'BS', '09/01/2026')],
      [i('Ana', 'DT', '08/01/2026')]
    );
    expect(r.jaExistem).toBe(1);
    expect(r.aImportar.map(x => x.nome)).toEqual(['Bruno']);
  });

  it('homônimo na mesma sede e data não é colapsado: 2 na planilha, 1 no banco → importa 1', () => {
    const r = planejarIntegracoes(
      [i('Ana', 'DT', '08/01/2026'), i('Ana', 'DT', '08/01/2026')],
      [i('Ana', 'DT', '08/01/2026')]
    );
    expect(r.aImportar).toHaveLength(1);
  });

  it('compara ignorando caixa e espaços', () => {
    const r = planejarIntegracoes([i(' ana ', 'dt', '08/01/2026')], [i('Ana', 'DT', '08/01/2026')]);
    expect(r.jaExistem).toBe(1);
  });
});
