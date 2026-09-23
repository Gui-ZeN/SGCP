import { describe, it, expect } from 'vitest';
import { normalizarNome, sugestoesDeCargo, setorExistente } from './catalogo';

describe('normalizarNome', () => {
  it('ignora caixa, acento e espaço sobrando', () => {
    expect(normalizarNome('  Auxiliar de  Cantína ')).toBe('auxiliar de cantina');
  });
});

describe('sugestoesDeCargo', () => {
  it('junta o cadastro com os nomes já usados em vagas', () => {
    expect(sugestoesDeCargo(['ASG'], ['Estoquista (Temporário)', 'ASG'])).toEqual(['ASG', 'Estoquista (Temporário)']);
  });

  it('a grafia do cadastro vence a das vagas', () => {
    expect(sugestoesDeCargo(['Auxiliar Administrativo'], ['auxiliar administrativo', 'AUXILIAR ADMINISTRATIVO']))
      .toEqual(['Auxiliar Administrativo']);
  });

  it('fora do cadastro, fica a grafia mais usada — uma só', () => {
    expect(sugestoesDeCargo([], ['Auxiliar de cantina', 'Auxiliar de Cantina', 'Auxiliar de Cantina']))
      .toEqual(['Auxiliar de Cantina']);
  });

  it('nome vazio não vira sugestão', () => {
    expect(sugestoesDeCargo([' '], ['', '  '])).toEqual([]);
  });
});

describe('setorExistente', () => {
  it('acha o setor mesmo com outra caixa ou sem acento', () => {
    expect(setorExistente(['Pedagógico', 'TI'], 'pedagogico')).toBe('Pedagógico');
    expect(setorExistente(['Pedagógico', 'TI'], 'Nutrição')).toBeUndefined();
  });
});
