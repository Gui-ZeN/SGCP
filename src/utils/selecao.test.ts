import { describe, it, expect } from 'vitest';
import { ehRealizada, estaAtrasada, validarAgendamento, validarConfirmacao, camposDaConfirmacao } from './selecao';

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
