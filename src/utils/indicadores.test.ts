import { describe, it, expect } from 'vitest';
import { integracaoPorSede, treinamentoPorSede, experienciaPorSede, totalGeral, filtrarPorMes, coletarAnos, taxaPresencaPorCargo, taxaTurnover } from './indicadores';
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

describe('filtrarPorMes', () => {
  const itens = [
    { d: '10/05/2026' }, { d: '22/05/2026' }, { d: '03/06/2026' }, { d: '15/05/2025' }, { d: '' },
  ];
  const g = (x: { d: string }) => x.d;
  it('sem filtro → tudo', () => expect(filtrarPorMes(itens, g, null, null)).toHaveLength(5));
  it('mês+ano específicos', () => expect(filtrarPorMes(itens, g, 5, 2026)).toHaveLength(2));
  it('só ano', () => expect(filtrarPorMes(itens, g, null, 2026)).toHaveLength(3));
  it('só mês (qualquer ano)', () => expect(filtrarPorMes(itens, g, 5, null)).toHaveLength(3));
  it('data inválida sai quando há filtro', () => expect(filtrarPorMes(itens, g, 6, 2026)).toHaveLength(1));
});

describe('coletarAnos', () => {
  it('anos distintos em ordem desc, ignora inválidos', () => {
    expect(coletarAnos(['10/05/2026', '01/01/2024', '22/05/2026', 'lixo', undefined])).toEqual([2026, 2024]);
  });
});

describe('taxaPresencaPorCargo', () => {
  const vagas = [
    { vaga: 'ASG', candChamados: 40, candCompareceram: 10 },
    { vaga: 'ASG', candChamados: 33, candCompareceram: 5 },
    { vaga: 'Recepcionista', candChamados: 19, candCompareceram: 5 },
    { vaga: 'Sem funil', candChamados: 0, candCompareceram: 0 }, // ignorado
  ];
  it('agrega por cargo, calcula ausentes e taxa, ordena por convocados', () => {
    const r = taxaPresencaPorCargo(vagas);
    expect(r.map(x => x.cargo)).toEqual(['ASG', 'Recepcionista']); // "Sem funil" fora
    expect(r[0]).toMatchObject({ convocados: 73, presentes: 15, ausentes: 58, taxa: 21 }); // 15/73 → 20.5 → 21
    expect(r[1]).toMatchObject({ convocados: 19, presentes: 5, taxa: 26 });
  });
});

describe('taxaTurnover', () => {
  it('lista vazia nao tem dados', () => {
    expect(taxaTurnover([])).toMatchObject({ temDados: false, taxa: 0, mesAno: '' });
  });

  it('usa a formula do modulo Turnover: ((admissoes + saidas) / 2) / efetivo', () => {
    // Caso real do banco em 27/08/2026: 07/2026, efetivo 150, 10 admissoes, 8+4 saidas.
    // ((10 + 12) / 2) / 150 = 11/150 = 7.333... -> 7.3
    const r = taxaTurnover([{ mesAno: '07/2026', totalFuncionarios: 150, totalAdmissao: 10, pediramSair: 8, foramDesligados: 4 }]);
    expect(r).toMatchObject({ temDados: true, mesAno: '07/2026', admissoes: 10, saidas: 12, totalFuncionarios: 150, taxa: 7.3 });
  });

  it('bate com o numero que TurnoverSection ja mostra', () => {
    // ((20 + 20) / 2) / 200 = 20/200 = 10%
    expect(taxaTurnover([{ mesAno: '01/2026', totalFuncionarios: 200, totalAdmissao: 20, pediramSair: 12, foramDesligados: 8 }]).taxa).toBe(10);
  });

  it('escolhe o mes mais recente por mesAno, nao pela ordem do array', () => {
    const r = taxaTurnover([
      { mesAno: '01/2026', totalFuncionarios: 100, totalAdmissao: 0, pediramSair: 20, foramDesligados: 0 },
      { mesAno: '12/2025', totalFuncionarios: 100, totalAdmissao: 0, pediramSair: 50, foramDesligados: 0 },
      { mesAno: '03/2026', totalFuncionarios: 200, totalAdmissao: 4, pediramSair: 2, foramDesligados: 2 },
      { mesAno: '02/2026', totalFuncionarios: 100, totalAdmissao: 0, pediramSair: 90, foramDesligados: 0 },
    ]);
    // ((4 + 4) / 2) / 200 = 2%
    expect(r).toMatchObject({ mesAno: '03/2026', admissoes: 4, saidas: 4, taxa: 2 });
  });

  it('arredonda para 1 casa decimal', () => {
    // ((0 + 5) / 2) / 150 = 1.666...% -> 1.7
    expect(taxaTurnover([{ mesAno: '05/2026', totalFuncionarios: 150, totalAdmissao: 0, pediramSair: 5, foramDesligados: 0 }]).taxa).toBe(1.7);
  });

  it('totalFuncionarios zero nao vira divisao por zero', () => {
    const r = taxaTurnover([{ mesAno: '05/2026', totalFuncionarios: 0, totalAdmissao: 2, pediramSair: 3, foramDesligados: 1 }]);
    expect(r).toMatchObject({ temDados: false, taxa: 0, saidas: 4, admissoes: 2, mesAno: '05/2026' });
  });

  it('campos ausentes contam como zero', () => {
    expect(taxaTurnover([{ mesAno: '05/2026', totalFuncionarios: 50 }])).toMatchObject({ temDados: true, saidas: 0, admissoes: 0, taxa: 0 });
  });

  it('mesAno fora do formato nao ganha de um mes valido', () => {
    const r = taxaTurnover([
      { mesAno: '06/2026', totalFuncionarios: 100, totalAdmissao: 2, pediramSair: 1, foramDesligados: 1 },
      { mesAno: 'lixo', totalFuncionarios: 100, totalAdmissao: 99, pediramSair: 99, foramDesligados: 0 },
    ]);
    expect(r).toMatchObject({ mesAno: '06/2026', taxa: 2 });
  });
});
