import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Parser da planilha "Acompanhamento do período de experiência" (Universidade).
 * Estrutura real: 1 aba por campus e o cabeçalho "APE" REPETIDO (avaliação do
 * 1º e do 2º período) — a leitura tem de ser posicional.
 */
const abas: Record<string, unknown[][]> = {};
vi.mock('read-excel-file/browser', () => ({
  readSheet: async (_f: unknown, aba: string) => {
    if (!abas[aba]) throw new Error('sem aba');
    return abas[aba];
  },
}));

const { parseExperienciasUniversidade } = await import('./experienciaUniImport');

const CAB = ['Nome', 'Função', 'Unidade', 'Admissão', '1º Período\n 45 dias', 'Supervisor', 'APE', '2º Período\n 75 dias', 'APE', 'Responsável', 'Observação'];
const dataUTC = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));
const arquivo = {} as File;
const linha = (nome: string, ape1: string, ape2: string, t2 = dataUTC(2024, 4, 17)) =>
  [nome, 'ASG', 'Aldeota', dataUTC(2024, 2, 2), dataUTC(2024, 3, 18), 'Erivelton', ape1, t2, ape2, 'Resp', 'obs'];

beforeEach(() => { for (const k of Object.keys(abas)) delete abas[k]; });

describe('status vem da decisão MAIS RECENTE (APE do 2º período antes do 1º)', () => {
  it('prorrogou aos 45 e efetivou aos 75 → EFETIVADO (não PRORROGADO)', async () => {
    abas['Aldeota'] = [CAB, linha('Ana', 'Prorrogar', 'Efetivar')];
    const { experiencias } = await parseExperienciasUniversidade(arquivo);
    expect(experiencias[0].status).toBe('EFETIVADO');
  });
  it('"Desligar" → ENCERRADO', async () => {
    abas['Aldeota'] = [CAB, linha('Bia', 'Prorrogar', 'Desligar')];
    const { experiencias } = await parseExperienciasUniversidade(arquivo);
    expect(experiencias[0].status).toBe('ENCERRADO');
  });
  it('só "Prorrogar" → PRORROGADO', async () => {
    abas['Aldeota'] = [CAB, linha('Caio', 'Prorrogar', 'Não realizado')];
    const { experiencias } = await parseExperienciasUniversidade(arquivo);
    expect(experiencias[0].status).toBe('PRORROGADO');
  });
  it('sem decisão: prazo futuro → EM_ANALISE; prazo vencido → EFETIVADO', async () => {
    const futuro = new Date(Date.UTC(new Date().getFullYear() + 1, 5, 10));
    abas['Aldeota'] = [CAB, linha('Corrente', 'Não realizado', 'Não realizado', futuro),
                            linha('Antigo', 'Não realizado', 'Não realizado', dataUTC(2020, 1, 1))];
    const { experiencias } = await parseExperienciasUniversidade(arquivo);
    expect(experiencias.find(e => e.colaborador === 'Corrente')!.status).toBe('EM_ANALISE');
    expect(experiencias.find(e => e.colaborador === 'Antigo')!.status).toBe('EFETIVADO');
  });
});

describe('prazos e campos', () => {
  it('grava os términos COMO ESTÃO (a Universidade usa 75 dias, não 90)', async () => {
    abas['Aldeota'] = [CAB, linha('Ana', 'Prorrogar', 'Efetivar')];
    const { experiencias } = await parseExperienciasUniversidade(arquivo);
    const e = experiencias[0];
    expect(e.dataAdmissao).toBe('02/02/2024');
    expect(e.termino1).toBe('18/03/2024');
    // 2º período conforme a planilha (~75 dias). O parser NÃO recalcula p/ 90.
    expect(e.termino2).toBe('17/04/2024');
  });

  it('as DUAS colunas APE são preservadas nas observações (nada se perde)', async () => {
    abas['Aldeota'] = [CAB, linha('Ana', 'Prorrogar', 'Efetivar')];
    const { experiencias } = await parseExperienciasUniversidade(arquivo);
    const obs = experiencias[0].observacoes!;
    expect(obs).toContain('APE 1º período: Prorrogar');
    expect(obs).toContain('APE 2º período: Efetivar');
    expect(obs).toContain('obs');
  });

  it('aba Benfica → UNIBENFICA; linha sem nome é ignorada com aviso', async () => {
    abas['Benfica'] = [CAB, [null, 'ASG', 'BN', null, null, null, '', null, '', null, null], linha('Valida', 'Efetivar', 'Efetivar')];
    const { experiencias, warnings } = await parseExperienciasUniversidade(arquivo);
    expect(experiencias.map(e => e.colaborador)).toEqual(['Valida']);
    expect(experiencias[0].sede).toBe('UNIBENFICA');
    expect(warnings.some(w => w.includes('sem nome'))).toBe(true);
  });
});
