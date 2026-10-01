import { describe, it, expect } from 'vitest';
import { FRASES_OUTUBRO_ROSA, sortearFraseOutubro, ehOutubro } from './outubroRosa';

describe('FRASES_OUTUBRO_ROSA', () => {
  it('tem variedade e nenhuma frase vazia/duplicada', () => {
    expect(FRASES_OUTUBRO_ROSA.length).toBeGreaterThanOrEqual(10);
    expect(FRASES_OUTUBRO_ROSA.every(f => f.trim().length > 0)).toBe(true);
    expect(new Set(FRASES_OUTUBRO_ROSA).size).toBe(FRASES_OUTUBRO_ROSA.length);
  });
  it('frases curtas o suficiente para caber na faixa', () => {
    expect(FRASES_OUTUBRO_ROSA.every(f => f.length <= 90)).toBe(true);
  });
  it('não arrisca número de idade ou frequência de exame', () => {
    expect(FRASES_OUTUBRO_ROSA.some(f => /\d/.test(f))).toBe(false);
  });
  it('sem descrição do corpo nem termo clínico (pedido de 01/10)', () => {
    const clinico = /mama|mamilo|n[óo]dulo|retra|mamografia|diagn[óo]stico|c[âa]ncer/i;
    expect(FRASES_OUTUBRO_ROSA.filter(f => clinico.test(f))).toEqual([]);
  });
});

describe('sortearFraseOutubro', () => {
  it('devolve a primeira/última nos extremos do sorteio (sem estourar o índice)', () => {
    expect(sortearFraseOutubro(() => 0)).toBe(FRASES_OUTUBRO_ROSA[0]);
    expect(sortearFraseOutubro(() => 1)).toBe(FRASES_OUTUBRO_ROSA[FRASES_OUTUBRO_ROSA.length - 1]);
  });
});

describe('ehOutubro', () => {
  it('só em outubro', () => {
    expect(ehOutubro(new Date(2026, 9, 1))).toBe(true);    // 01/10
    expect(ehOutubro(new Date(2026, 9, 31))).toBe(true);   // 31/10
    expect(ehOutubro(new Date(2026, 8, 30))).toBe(false);  // 30/09
    expect(ehOutubro(new Date(2026, 10, 1))).toBe(false);  // 01/11
  });
});
