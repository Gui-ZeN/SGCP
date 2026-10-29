import { describe, it, expect } from 'vitest';
import { pascoa, feriadosDoMes, linhasDosFeriados } from './feriados';

describe('feriados', () => {
  it('Páscoa conferida com o calendário', () => {
    expect(pascoa(2026)).toEqual({ mes: 4, dia: 5 });
    expect(pascoa(2027)).toEqual({ mes: 3, dia: 28 });
    expect(pascoa(2025)).toEqual({ mes: 4, dia: 20 });
  });
  it('móveis de 2026: Carnaval 16 e 17/02, Sexta-feira Santa 03/04, Corpus Christi 04/06', () => {
    expect(feriadosDoMes(2026, 2).map(f => f.dia)).toEqual([16, 17]);
    expect(feriadosDoMes(2026, 4).map(f => [f.dia, f.nome])).toEqual([[3, 'Sexta-feira Santa'], [13, 'Aniversário de Fortaleza'], [21, 'Tiradentes']]);
    expect(feriadosDoMes(2026, 6)).toEqual([{ dia: 4, nome: 'Corpus Christi' }]);
  });
  it('outubro sai como o deck: 12 e 15; novembro com Consciência Negra', () => {
    expect(linhasDosFeriados(2026, 10)).toBe('12/10 - Nossa Senhora Aparecida / Dia das Crianças\n15/10 - Dia dos Professores');
    expect(feriadosDoMes(2026, 11).map(f => f.dia)).toEqual([2, 15, 20]);
    expect(feriadosDoMes(2026, 7)).toEqual([]);
  });
});
