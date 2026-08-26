import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes do parser da planilha "Treinamento de integração" (Universidade).
 * O `readSheet` é simulado com a ESTRUTURA REAL do arquivo (1 aba por campus,
 * cabeçalho Nome/Função/Setor/Admissão/Supervisor/Integração/Data/...).
 */
const abas: Record<string, unknown[][]> = {};
vi.mock('read-excel-file/browser', () => ({
  readSheet: async (_f: unknown, aba: string) => {
    if (!abas[aba]) throw new Error('aba inexistente');
    return abas[aba];
  },
}));

const { parseIntegracoes } = await import('./integracaoImport');

const CAB = ['Nome', 'Função', 'Setor', 'Admissão', 'Supervisor', 'Integração', 'Data', 'Responsável', 'Contato', 'Observação'];
const arquivo = {} as File;

beforeEach(() => { for (const k of Object.keys(abas)) delete abas[k]; });

describe('parseIntegracoes — mapeamento de campus', () => {
  it('a aba "Benfica" vira UNIBENFICA (sede híbrida), não o BENFICA do Colégio', async () => {
    abas['Benfica'] = [CAB, ['Paulo Sergio', 'Gestor', 'BN', new Date(Date.UTC(2024, 1, 2)), 'Anna', 'Realizado', '18/03 às 9h', 'Nicole', null, null]];
    const { integracoes } = await parseIntegracoes(arquivo);
    expect(integracoes).toHaveLength(1);
    expect(integracoes[0].sede).toBe('UNIBENFICA');
  });

  it('cada aba mapeia para o nome canônico da sede', async () => {
    const linha = (n: string) => [n, 'F', 'S', new Date(Date.UTC(2024, 0, 10)), 'Sup', 'Realizado', '10/01', 'R', null, null];
    abas['Parquelândia'] = [CAB, linha('A')];
    abas['Parque Ecológico'] = [CAB, linha('B')];
    abas['Eusébio'] = [CAB, linha('C')];
    const { integracoes } = await parseIntegracoes(arquivo);
    expect(integracoes.map(i => i.sede).sort()).toEqual(['EUSEBIO', 'PARQUE ECOLÓGICO', 'PARQUELANDIA 3']);
  });
});

describe('parseIntegracoes — status', () => {
  beforeEach(() => {
    abas['Aldeota'] = [
      CAB,
      ['Feito', 'F', 'S', new Date(Date.UTC(2024, 3, 3)), 'Sup', 'Realizado', '19/08 as 14h', 'Monalisa', null, null],
      ['Pendente', 'F', 'S', new Date(Date.UTC(2024, 4, 2)), 'Sup', 'Não realizado', null, null, null, null],
      // a planilha marca "Desligado" na coluna DATA, não na de status
      ['Saiu', 'F', 'S', new Date(Date.UTC(2024, 8, 2)), 'Sup', 'Não realizado', 'Desligado', null, null, null],
    ];
  });

  it('deriva os três status, inclusive o "Desligado" que vem na coluna Data', async () => {
    const { integracoes } = await parseIntegracoes(arquivo);
    expect(integracoes.map(i => [i.nome, i.status])).toEqual([
      ['Feito', 'Realizado'],
      ['Pendente', 'Não realizado'],
      ['Saiu', 'Desligado'],
    ]);
  });

  it('desligado não carrega "Desligado" como data da integração', async () => {
    const { integracoes } = await parseIntegracoes(arquivo);
    expect(integracoes.find(i => i.nome === 'Saiu')!.dataIntegracao).toBe('');
    expect(integracoes.find(i => i.nome === 'Feito')!.dataIntegracao).toBe('19/08 as 14h');
  });
});

describe('parseIntegracoes — dados e robustez', () => {
  it('converte a admissão para DD/MM/YYYY e preserva os demais campos', async () => {
    abas['Dom Luis'] = [CAB, ['Ana Maria', 'Apoio de Andar', 'DL', new Date(Date.UTC(2024, 5, 19)), 'Nerissa', 'Realizado', '19/06 às 8h', 'Jenifer', '9999-0000', 'obs']];
    const { integracoes } = await parseIntegracoes(arquivo);
    expect(integracoes[0]).toMatchObject({
      nome: 'Ana Maria', funcao: 'Apoio de Andar', setor: 'DL',
      admissao: '19/06/2024', supervisor: 'Nerissa', responsavel: 'Jenifer',
      contato: '9999-0000', observacao: 'obs', sede: 'DOM LUÍS',
    });
  });

  it('ignora linha sem nome e avisa', async () => {
    abas['Eusébio'] = [CAB, [null, 'F', 'S', null, null, 'Realizado', null, null, null, null], ['Valida', 'F', 'S', null, 'Sup', 'Realizado', null, null, null, null]];
    const { integracoes, warnings } = await parseIntegracoes(arquivo);
    expect(integracoes.map(i => i.nome)).toEqual(['Valida']);
    expect(warnings.some(w => w.includes('sem nome'))).toBe(true);
  });

  it('aba ausente não quebra: avisa e segue com as outras', async () => {
    abas['Aldeota'] = [CAB, ['So Essa', 'F', 'S', null, 'Sup', 'Realizado', null, null, null, null]];
    const { integracoes, warnings } = await parseIntegracoes(arquivo);
    expect(integracoes).toHaveLength(1);
    expect(warnings.filter(w => w.includes('vazia ou não encontrada')).length).toBeGreaterThan(0);
  });
});
