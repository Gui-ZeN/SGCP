import { describe, it, expect } from 'vitest';
import { integracaoPorSede, treinamentoPorSede, experienciaPorSede, totalGeral } from './indicadores';
import type { Integracao, Treinamento, Experiencia } from '../types';

const integ = (sede: string, status: Integracao['status']): Integracao =>
  ({ id: sede + status + Math.random(), nome: 'X', sede, status } as Integracao);
const trein = (unidade: string, prev: number, real: number): Treinamento =>
  ({ unidade, qtdPrevista: prev, qtdRealizada: real } as Treinamento);
const exp = (sede: string, status: Experiencia['status']): Experiencia =>
  ({ sede, status } as Experiencia);

describe('integracaoPorSede', () => {
  const linhas = integracaoPorSede([
    integ('ALDEOTA', 'Realizado'), integ('ALDEOTA', 'Realizado'), integ('ALDEOTA', 'Não realizado'),
    integ('EUSEBIO', 'Realizado'), integ('EUSEBIO', 'Desligado'),
  ]);
  it('conta total, realizados e %', () => {
    const ald = linhas.find(l => l.sede === 'ALDEOTA')!;
    expect(ald.total).toBe(3);
    expect(ald.ok).toBe(2);
    expect(ald.pct).toBe(67); // 2/3 → 66.7 → 67
  });
  it('classifica desligado fora de "ok"', () => {
    const eus = linhas.find(l => l.sede === 'EUSEBIO')!;
    expect(eus.ok).toBe(1);
    expect(eus.detalhe.desligados).toBe(1);
    expect(eus.pct).toBe(50);
  });
  it('ordena por volume (total desc)', () => {
    expect(linhas[0].sede).toBe('ALDEOTA');
  });
});

describe('treinamentoPorSede', () => {
  it('soma previstos e realizados por unidade', () => {
    const linhas = treinamentoPorSede([trein('PE', 100, 92), trein('PE', 55, 51), trein('ALD', 86, 65)]);
    const pe = linhas.find(l => l.sede === 'PE')!;
    expect(pe.total).toBe(155);
    expect(pe.ok).toBe(143);
    expect(pe.pct).toBe(92); // 143/155
    expect(pe.detalhe.turmas).toBe(2);
  });
});

describe('experienciaPorSede', () => {
  const linhas = experienciaPorSede([
    exp('DL', 'EFETIVADO'), exp('DL', 'PRORROGADO'), exp('DL', 'ENCERRADO'), exp('DL', 'EM_ANALISE'),
  ]);
  it('“com desfecho” = tudo menos EM_ANALISE', () => {
    const dl = linhas.find(l => l.sede === 'DL')!;
    expect(dl.total).toBe(4);
    expect(dl.ok).toBe(3); // efetivado + prorrogado + encerrado
    expect(dl.pct).toBe(75);
    expect(dl.detalhe).toMatchObject({ emAnalise: 1, prorrogadas: 1, efetivadas: 1, desligadas: 1 });
  });
});

describe('totalGeral', () => {
  it('soma total/ok e recalcula o %', () => {
    const g = totalGeral(integracaoPorSede([
      integ('A', 'Realizado'), integ('A', 'Não realizado'), integ('B', 'Realizado'),
    ]));
    expect(g.sede).toBe('GERAL');
    expect(g.total).toBe(3);
    expect(g.ok).toBe(2);
    expect(g.pct).toBe(67);
  });
  it('total 0 → 0% (sem divisão por zero)', () => {
    expect(totalGeral([]).pct).toBe(0);
  });
});
