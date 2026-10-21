import { describe, it, expect } from 'vitest';
import { dataISODe, corteDaJanela, camposDeBusca, selecoesQueFaltam, faixaDoAno, emLotes, prefixoCoberto, mesclar } from './janelaCandidatos';

describe('dataISODe', () => {
  it('DD/MM/AAAA → AAAA-MM-DD, e vazio no que não é data', () => {
    expect(dataISODe('07/03/2026')).toBe('2026-03-07');
    expect(dataISODe(' 07/03/2026 ')).toBe('2026-03-07');
    expect(dataISODe('7/3/2026')).toBe('');
    expect(dataISODe('2026-03-07')).toBe('');
    expect(dataISODe(undefined)).toBe('');
  });
  it('ordena como texto na mesma ordem das datas', () => {
    expect(dataISODe('31/12/2025') < dataISODe('01/01/2026')).toBe(true);
  });
});

describe('corteDaJanela', () => {
  it('60 dias antes de hoje, atravessando o ano', () => {
    expect(corteDaJanela(new Date(2026, 9, 19))).toBe('2026-08-20');
    expect(corteDaJanela(new Date(2026, 0, 10))).toBe('2025-11-11');
  });
});

describe('camposDeBusca', () => {
  it('só os campos do que está sendo gravado', () => {
    expect(camposDeBusca({ resultado: 'ausente' } as any)).toEqual({});
    expect(camposDeBusca({ nome: '  José  da SILVA ', data: '05/10/2026' })).toEqual({ nomeNorm: 'jose da silva', dataISO: '2026-10-05' });
  });
});

describe('selecoesQueFaltam', () => {
  const corte = '2026-08-20';
  it('as de antes da janela e as de data ilegível, sem repetir as já pedidas', () => {
    const sel = [
      { id: 'a', data: '19/08/2026' }, { id: 'b', data: '20/08/2026' }, { id: 'c', data: '' },
      { id: 'd', data: '01/01/2025' }, { id: 'a', data: '19/08/2026' },
    ];
    expect(selecoesQueFaltam(sel, new Set(['d']), corte)).toEqual(['a', 'c']);
  });
});

describe('faixaDoAno', () => {
  it('o ano inteiro, cortado onde a janela começa', () => {
    expect(faixaDoAno(2025, '2026-08-20')).toEqual({ de: '2025-01-01', ate: '2026-01-01' });
    expect(faixaDoAno(2026, '2026-08-20')).toEqual({ de: '2026-01-01', ate: '2026-08-20' });
    expect(faixaDoAno(2027, '2026-08-20')).toBeNull();
  });
});

describe('emLotes / prefixoCoberto', () => {
  it('lotes de 30', () => {
    expect(emLotes(Array.from({ length: 61 }, (_, i) => i)).map(l => l.length)).toEqual([30, 30, 1]);
  });
  it('prefixo completo cobre o mais longo, não o contrário', () => {
    expect(prefixoCoberto('maria', ['mar'])).toBe(true);
    expect(prefixoCoberto('mar', ['maria'])).toBe(false);
  });
});

describe('mesclar', () => {
  it('a janela vence o que veio por pedido, sem repetir', () => {
    const j = [{ id: '1', nome: 'Bia', resultado: 'ausente' }] as any;
    const e = new Map([['1', { id: '1', nome: 'Bia', resultado: 'convocado' }], ['2', { id: '2', nome: 'Ana' }]] as any);
    const m = mesclar(j, e as any);
    expect(m.map(c => c.id)).toEqual(['2', '1']);
    expect(m.find(c => c.id === '1')!.resultado).toBe('ausente');
    expect(mesclar(j, new Map())).toBe(j);
  });
});

describe('mesclar com a escuta de pé', () => {
  it('da janela em diante só vale a escuta (apagado por outra pessoa não volta)', () => {
    const e = new Map([
      ['velho', { id: 'velho', nome: 'Ana', dataISO: '2026-01-05' }],
      ['apagado', { id: 'apagado', nome: 'Bia', dataISO: '2026-10-01' }],
      ['semData', { id: 'semData', nome: 'Caio' }],
    ] as any);
    expect(mesclar([], e as any, '2026-08-20').map(c => c.id).sort()).toEqual(['semData', 'velho']);
    // Escuta caída (sem corte): vale a cópia inteira.
    expect(mesclar([], e as any).map(c => c.id).sort()).toEqual(['apagado', 'semData', 'velho']);
  });
});
