import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { criarEscutasPausaveis } from './escutaPausavel';

/** Aba falsa: `esconder()`/`mostrar()` disparam o visibilitychange. */
function abaFalsa(escondida = false) {
  const ouvintes: (() => void)[] = [];
  const doc = {
    hidden: escondida,
    addEventListener: (_: string, fn: () => void) => { ouvintes.push(fn); },
  };
  const mudar = (h: boolean) => { doc.hidden = h; ouvintes.forEach(f => f()); };
  return { doc, esconder: () => mudar(true), mostrar: () => mudar(false) };
}

/** Uma escuta falsa que conta quantas vezes foi ligada e desligada. */
function escutaFalsa() {
  const c = { ligou: 0, desligou: 0 };
  return { c, ligar: () => { c.ligou++; return () => { c.desligou++; }; } };
}

const DEZ_MIN = 10 * 60_000;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('escutas que dormem com a aba', () => {
  it('escondida por 10 min: desliga; visível de novo: religa a mesma escuta', () => {
    const aba = abaFalsa();
    const escutar = criarEscutasPausaveis({ esperaMs: DEZ_MIN, documento: aba.doc });
    const e = escutaFalsa();
    escutar(e.ligar);
    expect(e.c).toEqual({ ligou: 1, desligou: 0 });
    aba.esconder();
    vi.advanceTimersByTime(DEZ_MIN - 1);
    expect(e.c.desligou).toBe(0);
    vi.advanceTimersByTime(1);
    expect(e.c).toEqual({ ligou: 1, desligou: 1 });
    // Madrugada inteira escondida: nada liga sozinho.
    vi.advanceTimersByTime(8 * 3600_000);
    expect(e.c.ligou).toBe(1);
    aba.mostrar();
    expect(e.c).toEqual({ ligou: 2, desligou: 1 });
  });

  it('volta antes dos 10 min: não desliga nada', () => {
    const aba = abaFalsa();
    const escutar = criarEscutasPausaveis({ esperaMs: DEZ_MIN, documento: aba.doc });
    const e = escutaFalsa();
    escutar(e.ligar);
    aba.esconder();
    vi.advanceTimersByTime(5 * 60_000);
    aba.mostrar();
    vi.advanceTimersByTime(DEZ_MIN * 3);
    expect(e.c).toEqual({ ligou: 1, desligou: 0 });
  });

  it('o hook desliga a escuta durante a pausa: ela não volta quando a aba volta', () => {
    const aba = abaFalsa();
    const escutar = criarEscutasPausaveis({ esperaMs: DEZ_MIN, documento: aba.doc });
    const e = escutaFalsa();
    const desligar = escutar(e.ligar);
    aba.esconder();
    vi.advanceTimersByTime(DEZ_MIN);
    desligar();
    aba.mostrar();
    expect(e.c).toEqual({ ligou: 1, desligou: 1 });
  });

  it('escuta criada durante a pausa só liga quando a aba volta', () => {
    const aba = abaFalsa();
    const escutar = criarEscutasPausaveis({ esperaMs: DEZ_MIN, documento: aba.doc });
    aba.esconder();
    vi.advanceTimersByTime(DEZ_MIN);
    const e = escutaFalsa();
    escutar(e.ligar);
    expect(e.c.ligou).toBe(0);
    aba.mostrar();
    expect(e.c.ligou).toBe(1);
  });

  it('aba aberta já em segundo plano também dorme depois de 10 min', () => {
    const aba = abaFalsa(true);
    const escutar = criarEscutasPausaveis({ esperaMs: DEZ_MIN, documento: aba.doc });
    const e = escutaFalsa();
    escutar(e.ligar);
    vi.advanceTimersByTime(DEZ_MIN);
    expect(e.c.desligou).toBe(1);
  });

  it('uma escuta que falha ao religar não impede as outras de religar', () => {
    const aba = abaFalsa();
    const escutar = criarEscutasPausaveis({ esperaMs: DEZ_MIN, documento: aba.doc });
    let quebrar = false;
    escutar(() => { if (quebrar) throw new Error('client terminated'); return () => {}; });
    const b = escutaFalsa();
    escutar(b.ligar);
    aba.esconder();
    vi.advanceTimersByTime(DEZ_MIN);
    quebrar = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => aba.mostrar()).not.toThrow();
    expect(b.c.ligou).toBe(2);
  });

  it('desligar duas vezes não desliga a escuta do SDK duas vezes', () => {
    const escutar = criarEscutasPausaveis({ esperaMs: DEZ_MIN });
    const e = escutaFalsa();
    const desligar = escutar(e.ligar);
    desligar(); desligar();
    expect(e.c.desligou).toBe(1);
  });
});
