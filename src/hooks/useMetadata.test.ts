import { describe, it, expect } from 'vitest';
import { unidadeDoCadastro } from './useMetadata';

const sedes = [
  { id: '1', nome: 'DIONISIO TORRES', regiao: 'Sudeste' },
  { id: '2', nome: 'ALDEOTA', regiao: 'Universidade' },
] as any[];

describe('unidadeDoCadastro', () => {
  it('com sede, a unidade vem da região da sede', () => {
    expect(unidadeDoCadastro({ sede: 'ALDEOTA', sedes })).toBe('universidade');
    expect(unidadeDoCadastro({ sede: 'dionisio torres', sedes })).toBe('colegio');
  });

  it('Visualizador (sem sede) cadastrado pelo Coordenador da Universidade fica na Universidade', () => {
    // Antes virava 'colegio' e a regra do banco recusava o cadastro.
    expect(unidadeDoCadastro({ sede: '', sedes, ator: { unidade: 'universidade' } })).toBe('universidade');
  });

  it('editar sem sede mantém a unidade que o cadastro já tinha, mesmo por um admin de outra unidade', () => {
    expect(unidadeDoCadastro({ sede: '', sedes, existente: { unidade: 'universidade' }, ator: { unidade: 'colegio' } })).toBe('universidade');
  });

  it('sem sede e sem referência nenhuma, Colégio (a convenção das regras)', () => {
    expect(unidadeDoCadastro({ sede: '', sedes })).toBe('colegio');
  });
});
