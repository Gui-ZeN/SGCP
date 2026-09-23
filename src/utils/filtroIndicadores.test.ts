import { describe, it, expect } from 'vitest';
import {
  siglaDaSede, opcoesDeSede, naSede, ehSemSede, anoMes, anoMesDeMesAno, noPeriodo, dataNoPeriodo, anosDosDados, rotuloDoPeriodo,
} from './filtroIndicadores';

const SEDES = [
  { id: '1', nome: 'DIONISIO TORRES', sigla: 'DT', regiao: '' },
  { id: '2', nome: 'PRE NUNES', sigla: 'PN', regiao: '' },
  { id: '3', nome: 'PRE SUL', sigla: 'PSUL', regiao: '' },
  { id: '4', nome: 'BARAO STUADART', sigla: 'BS', regiao: '' },
] as any[];

describe('sede pelo cadastro', () => {
  it('nome, sigla, acento, caixa e hífen caem na mesma sigla', () => {
    for (const r of ['DT', 'dt', 'DIONISIO TORRES', 'Dionísio Torres']) expect(siglaDaSede(SEDES, r)).toBe('DT');
    expect(siglaDaSede(SEDES, 'Pré Nunes')).toBe('PN');
    expect(siglaDaSede(SEDES, 'Pré - Sul')).toBe('PSUL');
  });

  it('sede fora do cadastro fica com o próprio nome — não some', () => {
    expect(siglaDaSede(SEDES, 'KMC2')).toBe('KMC2');
  });

  it('o filtro "DT" pega também as gravadas como "DIONISIO TORRES" (o bug do filtro antigo)', () => {
    const f = naSede(SEDES, 'DT');
    expect(['DT', 'DIONISIO TORRES', 'BS'].filter(f)).toEqual(['DT', 'DIONISIO TORRES']);
    expect(['DT', 'BS'].filter(naSede(SEDES, null))).toHaveLength(2);
  });

  it('opções: uma por sede, sem duplicata nem "A definir", com contagem', () => {
    const op = opcoesDeSede(SEDES, ['DT', 'DIONISIO TORRES', 'BS', 'Barão Stuadart', 'A definir', '-', '', 'KMC2', 'PRÉ-NUNES']);
    expect(op.map(o => o.valor)).toEqual(['BS', 'DT', 'KMC2', 'PN']);
    expect(op.find(o => o.valor === 'DT')).toMatchObject({ rotulo: 'DT · Dionisio Torres', registros: 2 });
    expect(op.find(o => o.valor === 'KMC2')!.rotulo).toBe('KMC2');
  });

  it('sede + local vira a sede; duas sedes ficam como estão', () => {
    expect(siglaDaSede(SEDES, 'DIONISIO TORRES / CPA')).toBe('DT');
    expect(siglaDaSede(SEDES, 'DIONISIO TORRES / Oficina')).toBe('DT');
    expect(siglaDaSede(SEDES, 'DT/BS')).toBe('DT/BS');
  });

  it('romano e "Equipe" na frente não criam sede nova', () => {
    const cad = [...SEDES, { id: '5', nome: 'PARQUELANDIA 2', sigla: 'PQL 2' }, { id: '6', nome: 'EQUIPE D.VALERIA', sigla: 'EDV' }] as any[];
    expect(siglaDaSede(cad, 'PQL II')).toBe('PQL 2');
    expect(siglaDaSede(cad, 'D.VALERIA')).toBe('EDV');
  });

  it('"Todas as sedes" não vira opção de filtro', () => {
    expect(opcoesDeSede(SEDES, ['Todas as sedes', 'TAS', 'DT']).map(o => o.valor)).toEqual(['DT']);
  });

  it('reconhece o que não é sede', () => {
    expect(['', '-', 'A definir', 'Não informado'].every(ehSemSede)).toBe(true);
    expect(ehSemSede('DT')).toBe(false);
  });
});

describe('período', () => {
  it('lê DD/MM/AAAA, AAAA-MM-DD e MM/AAAA', () => {
    expect(anoMes('23/09/2026')).toEqual([2026, 9]);
    expect(anoMes('2026-09-23')).toEqual([2026, 9]);
    expect(anoMes('')).toBeNull();
    expect(anoMesDeMesAno('08/2026')).toEqual([2026, 8]);
  });

  it('ano inteiro, mês do ano e "tudo"', () => {
    expect(dataNoPeriodo({ ano: 2026, mes: null }, '01/02/2026')).toBe(true);
    expect(dataNoPeriodo({ ano: 2026, mes: 9 }, '01/02/2026')).toBe(false);
    expect(dataNoPeriodo({ ano: 2025, mes: null }, '01/02/2026')).toBe(false);
    expect(dataNoPeriodo({ ano: null, mes: null }, '')).toBe(true);
  });

  it('registro sem data só entra quando o período é "tudo"', () => {
    expect(noPeriodo({ ano: 2026, mes: null }, null)).toBe(false);
  });

  it('anos dos dados, do mais recente; descarta ano absurdo', () => {
    expect(anosDosDados(['01/01/2025', '09/2026', 'x', '01/01/0206'])).toEqual([2026, 2025]);
  });

  it('rótulo legível', () => {
    expect(rotuloDoPeriodo({ ano: 2026, mes: 9 })).toBe('setembro de 2026');
    expect(rotuloDoPeriodo({ ano: 2026, mes: null })).toBe('2026');
    expect(rotuloDoPeriodo({ ano: null, mes: null })).toBe('todo o período');
  });
});
