import { describe, it, expect } from 'vitest';
import {
  parseNascimento, aniversariaHoje, diasAteAniversario, idade,
  aniversariantesDoMes, aniversariantesProximos
} from './aniversario';
import type { Funcionario } from '../types';

const f = (nome: string, dataNascimento: string, extra: Partial<Funcionario> = {}): Funcionario =>
  ({ id: nome, nome, dataNascimento, sede: 'DT', ...extra });

const HOJE = new Date(2026, 5, 24); // 24/06/2026 (qua)

describe('parseNascimento', () => {
  it('DD/MM/YYYY', () => expect(parseNascimento('24/06/1990')).toEqual({ dia: 24, mes: 6, ano: 1990 }));
  it('DD/MM (sem ano)', () => expect(parseNascimento('24/06')).toEqual({ dia: 24, mes: 6 }));
  it('inválido → null', () => {
    expect(parseNascimento('')).toBeNull();
    expect(parseNascimento('32/06/1990')).toBeNull();
    expect(parseNascimento('24/13')).toBeNull();
    expect(parseNascimento('abc')).toBeNull();
  });
});

describe('aniversariaHoje', () => {
  it('mesmo dia/mês → true (ignora ano)', () => expect(aniversariaHoje(f('A', '24/06/1985'), HOJE)).toBe(true));
  it('outro dia → false', () => expect(aniversariaHoje(f('B', '25/06/1985'), HOJE)).toBe(false));
});

describe('diasAteAniversario', () => {
  it('hoje → 0', () => expect(diasAteAniversario(f('A', '24/06'), HOJE)).toBe(0));
  it('amanhã → 1', () => expect(diasAteAniversario(f('A', '25/06'), HOJE)).toBe(1));
  it('já passou neste ano → conta p/ ano que vem', () => expect(diasAteAniversario(f('A', '23/06'), HOJE)).toBe(364));
});

describe('idade', () => {
  it('com ano → idade do ano corrente', () => expect(idade(f('A', '24/06/1990'), HOJE)).toBe(36));
  it('sem ano → null', () => expect(idade(f('A', '24/06'), HOJE)).toBeNull());
});

describe('aniversariantesDoMes', () => {
  const lista = [f('Jun1', '10/06'), f('Jul', '05/07'), f('Jun2', '02/06'), f('Desligado', '15/06', { ativo: false })];
  it('só do mês, ativos, ordenados por dia', () => {
    expect(aniversariantesDoMes(lista, 6).map(x => x.nome)).toEqual(['Jun2', 'Jun1']);
  });
});

describe('aniversariantesProximos', () => {
  const lista = [f('Hoje', '24/06'), f('Em3', '27/06'), f('Longe', '20/12'), f('Inativo', '25/06', { ativo: false })];
  it('dentro da janela, ativos, por proximidade', () => {
    expect(aniversariantesProximos(lista, 7, HOJE).map(x => x.nome)).toEqual(['Hoje', 'Em3']);
  });
});
