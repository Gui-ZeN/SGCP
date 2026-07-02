import { describe, it, expect } from 'vitest';
import {
  regiaoDaSede, sedeEhUniversidade, vagaEhUniversidade,
  escoparVagasPorUnidade, escoparSedesPorUnidade
} from './unidade';
import type { Vaga } from '../types';
import type { Sede } from '../hooks/useMetadata';

const SEDES: Sede[] = [
  { id: 's1', nome: 'DIONISIO TORRES', regiao: 'Dionísio Torres', sigla: 'DT' },
  { id: 's2', nome: 'SUL', regiao: 'Sul', sigla: 'SUL 1' },
  { id: 's3', nome: 'BARAO STUADART', regiao: 'Central', sigla: 'BS' },
  { id: 's4', nome: 'PARQUE ECOLÓGICO', regiao: 'Universidade', sigla: 'PE' },
  { id: 's5', nome: 'ALDEOTA', regiao: 'Universidade', sigla: 'ALD' },
];

const vaga = (p: Partial<Vaga>) => p as Vaga;
const VAGAS: Vaga[] = [
  vaga({ id: 'c1', vaga: 'Prof', sede: 'DIONISIO TORRES' }),
  vaga({ id: 'c2', vaga: 'Zelador', sede: 'SUL' }),
  vaga({ id: 'u1', vaga: 'Coordenador NPJ', sede: 'PARQUE ECOLÓGICO' }),
  vaga({ id: 'u2', vaga: 'Analista', sede: 'QUALQUER', origem: 'planilha-universidade' }), // origem manda, mesmo sede desconhecida
  vaga({ id: 'x1', vaga: 'Sem sede', sede: '' }), // sede vazia → Colégio (não some)
];

describe('regiaoDaSede / sedeEhUniversidade', () => {
  it('resolve por nome (case-insensitive)', () => {
    expect(regiaoDaSede(SEDES, 'dionisio torres')).toBe('Dionísio Torres');
    expect(sedeEhUniversidade(SEDES, 'ALDEOTA')).toBe(true);
    expect(sedeEhUniversidade(SEDES, 'SUL')).toBe(false);
  });
  it('sede desconhecida/vazia → não é Universidade', () => {
    expect(sedeEhUniversidade(SEDES, 'NAO EXISTE')).toBe(false);
    expect(sedeEhUniversidade(SEDES, undefined)).toBe(false);
  });
});

describe('vagaEhUniversidade', () => {
  it('por sede em região Universidade', () => expect(vagaEhUniversidade(VAGAS[2], SEDES)).toBe(true));
  it('por origem de planilha (independe da sede)', () => expect(vagaEhUniversidade(VAGAS[3], SEDES)).toBe(true));
  it('Colégio → false', () => expect(vagaEhUniversidade(VAGAS[0], SEDES)).toBe(false));
});

describe('escoparVagasPorUnidade (o isolamento)', () => {
  it('admin vê tudo', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, 'DIONISIO TORRES', true).map(v => v.id))
      .toEqual(['c1', 'c2', 'u1', 'u2', 'x1']);
  });
  it('usuário do Colégio vê TODO o Colégio (5 regiões se enxergam) e NUNCA a Universidade', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, 'BARAO STUADART', false).map(v => v.id))
      .toEqual(['c1', 'c2', 'x1']);
  });
  it('usuário da Universidade vê SÓ a Universidade', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, 'ALDEOTA', false).map(v => v.id))
      .toEqual(['u1', 'u2']);
  });
  it('usuário sem sede (ex.: Visualizador) conta como Colégio', () => {
    expect(escoparVagasPorUnidade(VAGAS, SEDES, undefined, false).map(v => v.id))
      .toEqual(['c1', 'c2', 'x1']);
  });
});

describe('escoparSedesPorUnidade (filtros)', () => {
  it('Colégio não lista sedes da Universidade', () => {
    expect(escoparSedesPorUnidade(SEDES, 'SUL', false).map(s => s.sigla))
      .toEqual(['DT', 'SUL 1', 'BS']);
  });
  it('Universidade só lista as suas', () => {
    expect(escoparSedesPorUnidade(SEDES, 'PARQUE ECOLÓGICO', false).map(s => s.sigla))
      .toEqual(['PE', 'ALD']);
  });
  it('admin vê todas', () => {
    expect(escoparSedesPorUnidade(SEDES, 'SUL', true)).toHaveLength(5);
  });
});
