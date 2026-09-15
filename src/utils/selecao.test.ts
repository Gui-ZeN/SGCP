import { describe, it, expect } from 'vitest';
import { ehRealizada, estaAtrasada, validarAgendamento, validarConfirmacao, camposDaConfirmacao, totaisDeSelecoes, codigosDasVagas } from './selecao';
import type { Selecao } from '../types';

const dia = (over: Partial<Selecao>): Selecao => ({
  id: 'x', data: '10/09/2026', cargo: 'ASG', sede: 'DT', responsavel: 'Arlana',
  origem: 'geral', convocados: 0, compareceram: 0, ausentes: 0, contratados: 0,
  desistiram: 0, ...over,
});

describe('ehRealizada', () => {
  it('registro SEM status conta como realizado (os 220 importados da planilha)', () => {
    expect(ehRealizada({} as any)).toBe(true);
  });
  it('agendado não é realizado', () => {
    expect(ehRealizada({ status: 'agendado' })).toBe(false);
  });
  it('realizado é realizado', () => {
    expect(ehRealizada({ status: 'realizado' })).toBe(true);
  });
});

describe('estaAtrasada', () => {
  const hoje = '10/09/2026';

  it('agendado com data passada e sem confirmação está atrasado', () => {
    expect(estaAtrasada({ status: 'agendado', data: '08/09/2026' }, hoje)).toBe(true);
  });
  it('agendado para hoje ainda não está atrasado', () => {
    expect(estaAtrasada({ status: 'agendado', data: hoje }, hoje)).toBe(false);
  });
  it('agendado para o futuro não está atrasado', () => {
    expect(estaAtrasada({ status: 'agendado', data: '15/09/2026' }, hoje)).toBe(false);
  });
  it('já realizado nunca está atrasado, mesmo antigo', () => {
    expect(estaAtrasada({ status: 'realizado', data: '01/01/2026' }, hoje)).toBe(false);
  });
  it('compara por dia/mês/ano, não por texto', () => {
    // '09/12/2025' < '10/09/2026' — comparação ingênua de string diria o contrário.
    expect(estaAtrasada({ status: 'agendado', data: '09/12/2025' }, hoje)).toBe(true);
  });
});

describe('validarAgendamento', () => {
  const ok = { data: '15/09/2026', cargo: 'ASG', sede: 'DT', convocados: 5 };

  it('agendamento completo passa', () => {
    expect(validarAgendamento(ok)).toEqual([]);
  });
  it('exige data, cargo, sede e convocados', () => {
    expect(validarAgendamento({})).toHaveLength(4);
  });
  it('não aceita convocar zero pessoas', () => {
    expect(validarAgendamento({ ...ok, convocados: 0 }))
      .toContain('Informe quantas pessoas foram convocadas.');
  });
});

describe('validarConfirmacao', () => {
  it('presentes dentro do convocado passa', () => {
    expect(validarConfirmacao(10, 4)).toEqual([]);
  });
  it('ninguém apareceu é válido — é o dado que o RH quer mostrar', () => {
    expect(validarConfirmacao(10, 0)).toEqual([]);
  });
  it('mais presentes que convocados é recusado (viraria taxa acima de 100%)', () => {
    expect(validarConfirmacao(5, 8)[0]).toContain('não pode ser maior');
  });
});

describe('camposDaConfirmacao', () => {
  it('calcula os ausentes em vez de pedir digitação', () => {
    expect(camposDaConfirmacao(10, 4)).toEqual({ status: 'realizado', compareceram: 4, ausentes: 6 });
  });
  it('nunca devolve ausentes negativo', () => {
    expect(camposDaConfirmacao(3, 3).ausentes).toBe(0);
  });
});

describe('totaisDeSelecoes', () => {
  it('soma os dias realizados e calcula a taxa', () => {
    const t = totaisDeSelecoes([
      dia({ convocados: 10, compareceram: 4, ausentes: 6, desistiram: 2, contratados: 1 }),
      dia({ convocados: 10, compareceram: 6, ausentes: 4 }),
    ]);
    expect(t).toMatchObject({ convocados: 20, compareceram: 10, ausentes: 10, desistiram: 2, contratados: 1, taxa: 50 });
  });

  it('agendado fica fora da taxa — senão um dia que nem chegou derruba o indicador', () => {
    const t = totaisDeSelecoes([
      dia({ convocados: 10, compareceram: 5, ausentes: 5 }),
      dia({ status: 'agendado', convocados: 40 }),
    ]);
    expect(t.convocados).toBe(10);
    expect(t.taxa).toBe(50);
    expect(t.aConfirmar).toBe(1);
  });

  it('sem nada realizado a taxa é null, não zero', () => {
    expect(totaisDeSelecoes([dia({ status: 'agendado', convocados: 5 })]).taxa).toBeNull();
    expect(totaisDeSelecoes([]).taxa).toBeNull();
  });

  it('arredonda a taxa a uma casa', () => {
    expect(totaisDeSelecoes([dia({ convocados: 3, compareceram: 1 })]).taxa).toBe(33.3);
  });
});

describe('codigosDasVagas', () => {
  it('lê a lista de vagas — uma seleção atende várias', () => {
    expect(codigosDasVagas({ vagaCodigos: [31, 1120] })).toEqual([31, 1120]);
  });

  it('ainda lê o vínculo único gravado antes da lista', () => {
    expect(codigosDasVagas({ vagaCodigo: 24 })).toEqual([24]);
  });

  it('a lista tem precedência quando os dois existem', () => {
    expect(codigosDasVagas({ vagaCodigos: [31, 1120], vagaCodigo: 24 })).toEqual([31, 1120]);
  });

  it('seleção sem vaga devolve lista vazia (pedagógico chama sem vaga)', () => {
    expect(codigosDasVagas({})).toEqual([]);
  });

  it('código zero não é tratado como ausência', () => {
    expect(codigosDasVagas({ vagaCodigo: 0 })).toEqual([0]);
  });
});
