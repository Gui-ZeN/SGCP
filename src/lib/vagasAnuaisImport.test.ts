import { describe, it, expect, vi, beforeEach } from 'vitest';

// O parser lê a planilha pelo `read-excel-file/browser`; nos testes trocamos a
// leitura por matrizes fixas, para exercitar as diferenças reais entre as abas
// (2026 sem `Etapa` e com lembrete na 1ª linha; 2023 com `Cargo`/`Observação`).
//
// O mock do export default devolve `{ sheet, data }`, que é a FORMA REAL da
// v9 da lib. Uma versão anterior deste mock usava `{ name }`: o teste passava
// e a tela abria o dropdown de abas vazio.
const matrizes: Record<string, unknown[][]> = {};
// Ordem das abas vive num array: chaves numéricas em objeto JS são reordenadas
// em ordem crescente, o que mascararia a ordem real do arquivo.
const ordemDasAbas: string[] = [];

vi.mock('read-excel-file/browser', () => ({
  default: vi.fn(async () => ordemDasAbas.map(sheet => ({ sheet, data: matrizes[sheet] || [] }))),
  readSheet: vi.fn(async (_file: unknown, aba: string) => {
    if (!(aba in matrizes)) throw new Error('aba inexistente');
    return matrizes[aba];
  }),
}));

const { listarAbas, parseVagasDaAba, planejarImportacao } = await import('./vagasAnuaisImport');

const arquivo = {} as File;
const data = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));

const CAB_PADRAO = ['Vaga', 'Sede', 'Status', 'Setor', 'Sexo', 'Solicitação', 'Solicitante',
                    'Motivo', 'Funcionário a ser substituído', 'Etapa', 'Aprovado',
                    'Observações', 'Responsável', 'Conclusão', 'Tempo do processo'];

beforeEach(() => {
  for (const k of Object.keys(matrizes)) delete matrizes[k];
  ordemDasAbas.length = 0;
});

describe('listarAbas', () => {
  it('devolve os nomes das abas na ordem do arquivo', async () => {
    ordemDasAbas.push('2026', '2025', '2024');
    expect(await listarAbas(arquivo)).toEqual(['2026', '2025', '2024']);
  });
});

describe('parseVagasDaAba', () => {
  it('lê a aba de 2025 no formato completo', async () => {
    matrizes['2025'] = [
      CAB_PADRAO,
      ['ASG', 'D.VALERIA', 'ABERTA', 'D. Valéria', 'MASCULINO', data(2025, 5, 27), 'D. Valéria',
       'Aumento de quadro', '', 'Triagem de currículos', 'Antônio Bruno', 'obs', 'Arlana',
       data(2025, 7, 31), 65],
    ];

    const { vagas, ignoradas } = await parseVagasDaAba(arquivo, '2025');

    expect(ignoradas).toHaveLength(0);
    expect(vagas).toHaveLength(1);
    expect(vagas[0]).toMatchObject({
      vaga: 'ASG',
      sede: 'D.VALERIA',
      status: 'ABERTA',
      setor: 'D. Valéria',
      sexo: 'MASCULINO',
      solicitacao: '27/05/2025',
      conclusao: '31/07/2025',
      etapa: 'Triagem de currículos',
      tempoProcesso: 65,
      ano: 2025,
      categoria: 'Importado',
      categoriaMotivo: 'Aumento de Quadro',
    });
  });

  it('lê a aba de 2026, que tem lembrete na 1ª linha e NÃO tem coluna Etapa', async () => {
    matrizes['2026'] = [
      ['Usar planilha do DASHBOARD', null, null, null, null, null, null],
      ['Vaga', 'Sede', 'Status', 'Setor', 'Sexo', 'Solicitação', 'Solicitante'],
      ['Desenvolvedor pleno', 'Construtora', 'ABERTA', 'Construtora', 'Indiferente', data(2026, 5, 11), 'Eveline'],
    ];

    const { vagas } = await parseVagasDaAba(arquivo, '2026');

    expect(vagas).toHaveLength(1);
    expect(vagas[0].vaga).toBe('Desenvolvedor pleno');
    expect(vagas[0].solicitacao).toBe('11/05/2026');
    expect(vagas[0].etapa).toBe(''); // coluna ausente não vira undefined
    expect(vagas[0].sexo).toBe('INDIFERENTE');
  });

  it('aceita "Cargo" e "Observação" (nomes da aba de 2023)', async () => {
    matrizes['2023'] = [
      ['Cargo', 'Sede', 'Setor', 'sexo', 'Solicitação', 'Solicitante', 'Status', 'Observação'],
      ['Apoio de supervisão', 'BS', 'Pedagógico', 'Indiferente', data(2023, 1, 25), 'Cristina', 'Fechada', 'nota'],
    ];

    const { vagas } = await parseVagasDaAba(arquivo, '2023');

    expect(vagas[0].vaga).toBe('Apoio de supervisão');
    expect(vagas[0].observacoes).toBe('nota');
    expect(vagas[0].status).toBe('FECHADA'); // "Fechada" minúsculo normaliza
  });

  it('ignora linha sem cargo e linha sem data de solicitação, dizendo o porquê', async () => {
    matrizes['2025'] = [
      CAB_PADRAO,
      ['', 'DT', 'ABERTA', 'TI', '', data(2025, 3, 1), 'Fulano'],
      ['Analista', 'DT', 'ABERTA', 'TI', '', null, 'Fulano'],
      ['Válida', 'DT', 'ABERTA', 'TI', '', data(2025, 3, 2), 'Fulano'],
    ];

    const { vagas, ignoradas } = await parseVagasDaAba(arquivo, '2025');

    expect(vagas.map(v => v.vaga)).toEqual(['Válida']);
    expect(ignoradas).toHaveLength(2);
    expect(ignoradas[0]).toContain('sem cargo');
    expect(ignoradas[1]).toContain('sem data de solicitação');
  });

  it('devolve vazio para aba inexistente em vez de estourar', async () => {
    const { vagas } = await parseVagasDaAba(arquivo, 'aba que não existe');
    expect(vagas).toEqual([]);
  });
});

describe('planejarImportacao', () => {
  const v = (vaga: string, sede: string, solicitacao: string) =>
    ({ vaga, sede, solicitacao }) as any;

  it('pula as que já existem no banco', () => {
    const plano = planejarImportacao(
      [v('ASG', 'DT', '01/02/2025'), v('Analista', 'BS', '03/03/2025')],
      [v('ASG', 'DT', '01/02/2025')]
    );

    expect(plano.jaExistem).toBe(1);
    expect(plano.aImportar.map(x => x.vaga)).toEqual(['Analista']);
  });

  it('NÃO colapsa vagas repetidas de verdade: 3 na planilha, 1 no banco → importa 2', () => {
    const plano = planejarImportacao(
      [v('ASG', 'DT', '01/02/2025'), v('ASG', 'DT', '01/02/2025'), v('ASG', 'DT', '01/02/2025')],
      [v('ASG', 'DT', '01/02/2025')]
    );

    expect(plano.jaExistem).toBe(1);
    expect(plano.aImportar).toHaveLength(2);
  });

  it('importa as 3 quando o banco não tem nenhuma', () => {
    const tres = [v('ASG', 'DT', '01/02/2025'), v('ASG', 'DT', '01/02/2025'), v('ASG', 'DT', '01/02/2025')];
    expect(planejarImportacao(tres, []).aImportar).toHaveLength(3);
  });

  it('compara ignorando caixa e espaços em volta', () => {
    const plano = planejarImportacao(
      [v(' asg ', 'dt', '01/02/2025')],
      [v('ASG', 'DT', '01/02/2025')]
    );
    expect(plano.jaExistem).toBe(1);
    expect(plano.aImportar).toHaveLength(0);
  });

  it('data diferente é vaga diferente', () => {
    const plano = planejarImportacao(
      [v('ASG', 'DT', '02/02/2025')],
      [v('ASG', 'DT', '01/02/2025')]
    );
    expect(plano.aImportar).toHaveLength(1);
  });

  it('repassa a lista de ignoradas', () => {
    expect(planejarImportacao([], [], ['linha 5: sem cargo']).ignoradas).toEqual(['linha 5: sem cargo']);
  });
});
