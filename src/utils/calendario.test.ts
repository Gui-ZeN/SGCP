import { describe, it, expect } from 'vitest';
import { rotuloTipo, corDaData, diasAteData, rotuloRelativo, dataCurtaBR } from './calendario';

describe('rotuloTipo', () => {
  it('mapeia os tipos', () => {
    expect(rotuloTipo('feriado')).toBe('Feriado');
    expect(rotuloTipo('dia_profissao')).toBe('Dia da profissão');
  });
});

describe('corDaData', () => {
  it('usa a cor sugerida quando é hex válido', () => {
    expect(corDaData('feriado', '#123ABC')).toBe('#123ABC');
  });
  it('cai no padrão do tipo quando inválida/ausente', () => {
    expect(corDaData('feriado', 'azul')).toBe('#E11D48');
    expect(corDaData('dia_profissao', null)).toBe('#059669');
  });
});

describe('diasAteData', () => {
  const hoje = new Date(2026, 5, 24); // 24/06/2026
  it('hoje = 0, amanhã = 1, passado negativo', () => {
    expect(diasAteData('2026-06-24', hoje)).toBe(0);
    expect(diasAteData('2026-06-25', hoje)).toBe(1);
    expect(diasAteData('2026-06-20', hoje)).toBe(-4);
  });
  it('data inválida → null', () => {
    expect(diasAteData('', hoje)).toBeNull();
    expect(diasAteData('xx', hoje)).toBeNull();
  });
});

describe('rotuloRelativo', () => {
  it('hoje / amanhã / em N dias', () => {
    expect(rotuloRelativo(0)).toBe('hoje');
    expect(rotuloRelativo(1)).toBe('amanhã');
    expect(rotuloRelativo(5)).toBe('em 5 dias');
  });
});

describe('dataCurtaBR', () => {
  it('dia da semana + dd/mm', () => {
    expect(dataCurtaBR('2026-06-24')).toBe('qua, 24/06');
  });
  it('inválida devolve o original', () => {
    expect(dataCurtaBR('nada')).toBe('nada');
  });
});
