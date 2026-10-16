import { describe, it, expect } from 'vitest';
import { faixaQueFalta } from './useLogs';

// Janela ao vivo de 45 dias; o resto vem a pedido (16/10/2026).
describe('faixaQueFalta', () => {
  const ANO = '2026-01-01';
  const CORTE_OUT = '2026-09-01T12:00:00.000Z'; // 45 dias antes de meados de outubro
  const CORTE_JAN = '2025-12-20T12:00:00.000Z'; // em janeiro a janela começa no ano anterior

  it('o ano: de 1º de janeiro até onde a janela começa', () => {
    expect(faixaQueFalta('recentes', 'ano', CORTE_OUT, ANO)).toEqual({ desde: ANO, ate: CORTE_OUT });
  });

  it('tudo, sem nada antes: tudo o que vem antes da janela', () => {
    expect(faixaQueFalta('recentes', 'tudo', CORTE_OUT, ANO)).toEqual({ desde: '', ate: CORTE_OUT });
  });

  it('tudo depois do ano: só o que vem antes do ano (sem rebuscar o ano)', () => {
    expect(faixaQueFalta('ano', 'tudo', CORTE_OUT, ANO)).toEqual({ desde: '', ate: ANO });
  });

  it('já carregado: nada a buscar', () => {
    expect(faixaQueFalta('ano', 'ano', CORTE_OUT, ANO)).toBeNull();
    expect(faixaQueFalta('tudo', 'ano', CORTE_OUT, ANO)).toBeNull();
    expect(faixaQueFalta('tudo', 'tudo', CORTE_OUT, ANO)).toBeNull();
  });

  it('em janeiro o ano inteiro já está na janela ao vivo', () => {
    expect(faixaQueFalta('recentes', 'ano', CORTE_JAN, ANO)).toBe('nada');
    // e "tudo" depois disso continua buscando antes da janela, não antes do ano
    expect(faixaQueFalta('ano', 'tudo', CORTE_JAN, ANO)).toEqual({ desde: '', ate: CORTE_JAN });
  });
});
