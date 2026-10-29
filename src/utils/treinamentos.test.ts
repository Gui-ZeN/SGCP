import { describe, it, expect } from 'vitest';
import { sedesDaTurma, turmaNaSede, erroDasSedes } from './treinamentos';
import type { Sede } from '../hooks/useMetadata';

const CATALOGO: Sede[] = [
  { id: '1', nome: 'DIONISIO TORRES', regiao: 'Dionísio Torres', sigla: 'DT' },
  { id: '2', nome: 'SUL', regiao: 'Sul', sigla: 'SUL 1' },
  { id: '3', nome: 'ALDEOTA', regiao: 'Universidade', sigla: 'ALD' },
];

describe('sedesDaTurma / turmaNaSede', () => {
  it('turma antiga (só `unidade`) vale como uma sede; a nova usa a lista', () => {
    expect(sedesDaTurma({ unidade: 'SUL' })).toEqual(['SUL']);
    expect(sedesDaTurma({ unidade: 'SUL', sedes: ['SUL', 'DIONISIO TORRES'] })).toEqual(['SUL', 'DIONISIO TORRES']);
    expect(sedesDaTurma({ unidade: '' })).toEqual([]);
  });
  it('aparece no filtro de QUALQUER uma das sedes, sem diferença de caixa', () => {
    const t = { unidade: 'SUL', sedes: ['SUL', 'DIONISIO TORRES'] };
    expect(turmaNaSede(t, 'dionisio torres')).toBe(true);
    expect(turmaNaSede(t, 'ALDEOTA')).toBe(false);
  });
});

describe('erroDasSedes', () => {
  it('nenhuma sede: pede ao menos uma', () => {
    expect(erroDasSedes([], CATALOGO)).toMatch(/ao menos uma/);
  });
  it('várias do Colégio passam; Colégio com Universidade não', () => {
    expect(erroDasSedes(['SUL', 'DIONISIO TORRES'], CATALOGO)).toBeNull();
    expect(erroDasSedes(['SUL', 'ALDEOTA'], CATALOGO)).toMatch(/mesma unidade/);
  });
});
