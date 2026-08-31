import { describe, it, expect } from 'vitest';
import { coerirAtendimento, validarConsulta, type ConsultaInput, diasDeEspera } from './consulta';

const VALIDA: ConsultaInput = {
  funcionario: 'Marcos Vinícius Silva',
  especialidade: 'Ortodontia',
  dataSolicitacao: '10/08/2026',
  status: 'No aguardo'
};

describe('coerirAtendimento', () => {
  it('mantém a data quando o status é Atendido', () => {
    const c = { status: 'Atendido' as const, dataAtendimento: '15/08/2026' };
    expect(coerirAtendimento(c)).toEqual(c);
  });

  it('limpa a data ao voltar para No aguardo (não guarda atendimento que não vale mais)', () => {
    const c = { status: 'No aguardo' as const, dataAtendimento: '15/08/2026' };
    expect(coerirAtendimento(c).dataAtendimento).toBe('');
  });

  it('não quebra quando a consulta em aguardo já vem sem data', () => {
    const semData: { status: 'No aguardo'; dataAtendimento?: string } = { status: 'No aguardo' };
    expect(coerirAtendimento(semData).dataAtendimento).toBe('');
  });
});

describe('validarConsulta', () => {
  it('aceita o registro completo em aguardo', () => {
    expect(validarConsulta(VALIDA)).toEqual([]);
  });

  it('aceita o registro atendido com data', () => {
    expect(validarConsulta({ ...VALIDA, status: 'Atendido', dataAtendimento: '15/08/2026' })).toEqual([]);
  });

  it('cobra funcionário e especialidade (espaço em branco não conta)', () => {
    const erros = validarConsulta({ ...VALIDA, funcionario: '   ', especialidade: '' });
    expect(erros).toContain('Informe o funcionário.');
    expect(erros).toContain('Informe a especialidade solicitada.');
  });

  it('recusa data de solicitação ausente ou impossível', () => {
    expect(validarConsulta({ ...VALIDA, dataSolicitacao: '' }))
      .toContain('Informe uma data de solicitação válida.');
    expect(validarConsulta({ ...VALIDA, dataSolicitacao: '45/13/2026' }))
      .toContain('Informe uma data de solicitação válida.');
  });

  it('recusa status fora da lista', () => {
    expect(validarConsulta({ ...VALIDA, status: 'Cancelado' as any }))
      .toContain('Selecione um status válido.');
  });

  it('Atendido sem data é recusado', () => {
    expect(validarConsulta({ ...VALIDA, status: 'Atendido' }))
      .toContain('Consulta atendida exige a data do atendimento.');
  });

  it('atendimento antes da solicitação é recusado', () => {
    expect(validarConsulta({ ...VALIDA, status: 'Atendido', dataAtendimento: '09/08/2026' }))
      .toContain('A data do atendimento não pode ser anterior à da solicitação.');
  });

  it('atendimento no mesmo dia da solicitação é aceito', () => {
    expect(validarConsulta({ ...VALIDA, status: 'Atendido', dataAtendimento: '10/08/2026' })).toEqual([]);
  });

  it('em aguardo não cobra data de atendimento', () => {
    expect(validarConsulta({ ...VALIDA, dataAtendimento: '' })).toEqual([]);
  });
});

describe('diasDeEspera', () => {
  const hoje = new Date(2026, 7, 31); // 31/08/2026, hora local

  it('atendida conta da solicitação até o atendimento', () => {
    expect(diasDeEspera(
      { status: 'Atendido', dataSolicitacao: '10/08/2026', dataAtendimento: '20/08/2026' }, hoje
    )).toBe(10);
  });

  it('na fila conta até hoje', () => {
    expect(diasDeEspera({ status: 'No aguardo', dataSolicitacao: '21/08/2026' }, hoje)).toBe(10);
  });

  it('atendida no mesmo dia é zero, não vazio', () => {
    expect(diasDeEspera(
      { status: 'Atendido', dataSolicitacao: '10/08/2026', dataAtendimento: '10/08/2026' }, hoje
    )).toBe(0);
  });

  it('devolve null quando falta data — célula vazia, não zero', () => {
    expect(diasDeEspera({ status: 'Atendido', dataSolicitacao: '10/08/2026' }, hoje)).toBeNull();
    expect(diasDeEspera({ status: 'No aguardo', dataSolicitacao: '' }, hoje)).toBeNull();
  });

  it('devolve null se o atendimento for anterior à solicitação (dado incoerente)', () => {
    expect(diasDeEspera(
      { status: 'Atendido', dataSolicitacao: '20/08/2026', dataAtendimento: '10/08/2026' }, hoje
    )).toBeNull();
  });
});
