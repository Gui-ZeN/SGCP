import { describe, it, expect } from 'vitest';
import { FRASES_SETEMBRO_AMARELO, sortearFrase, ehSetembro, CVV } from './setembroAmarelo';

describe('FRASES_SETEMBRO_AMARELO', () => {
  it('tem variedade e nenhuma frase vazia/duplicada', () => {
    expect(FRASES_SETEMBRO_AMARELO.length).toBeGreaterThanOrEqual(10);
    expect(FRASES_SETEMBRO_AMARELO.every(f => f.trim().length > 0)).toBe(true);
    expect(new Set(FRASES_SETEMBRO_AMARELO).size).toBe(FRASES_SETEMBRO_AMARELO.length);
  });
  it('cita o canal de apoio (CVV 188)', () => {
    expect(FRASES_SETEMBRO_AMARELO.some(f => f.includes('188'))).toBe(true);
    expect(CVV.telefone).toBe('188');
  });
});

describe('sortearFrase', () => {
  it('devolve a primeira/última nos extremos do sorteio (sem estourar o índice)', () => {
    expect(sortearFrase(() => 0)).toBe(FRASES_SETEMBRO_AMARELO[0]);
    expect(sortearFrase(() => 0.999999)).toBe(FRASES_SETEMBRO_AMARELO[FRASES_SETEMBRO_AMARELO.length - 1]);
    expect(sortearFrase(() => 1)).toBe(FRASES_SETEMBRO_AMARELO[FRASES_SETEMBRO_AMARELO.length - 1]);
  });
  it('sempre devolve uma frase da lista', () => {
    for (let i = 0; i < 50; i++) {
      expect(FRASES_SETEMBRO_AMARELO).toContain(sortearFrase());
    }
  });
});

describe('ehSetembro', () => {
  it('só em setembro', () => {
    expect(ehSetembro(new Date(2026, 8, 1))).toBe(true);   // 01/09
    expect(ehSetembro(new Date(2026, 8, 30))).toBe(true);  // 30/09
    expect(ehSetembro(new Date(2026, 7, 31))).toBe(false); // 31/08
    expect(ehSetembro(new Date(2026, 9, 1))).toBe(false);  // 01/10
  });
});
