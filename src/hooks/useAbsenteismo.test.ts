import { describe, it, expect } from 'vitest';
import { mesesDoPeriodo } from './useAbsenteismo';

describe('mesesDoPeriodo — o período dos Indicadores em meses do Chromos', () => {
  const hoje = '2026-10-06';
  it('ano corrente vai de janeiro até o mês de hoje', () => {
    expect(mesesDoPeriodo({ ano: 2026, mes: null }, hoje)).toEqual({ de: '2026-01', ate: '2026-10' });
  });
  it('ano passado inteiro', () => {
    expect(mesesDoPeriodo({ ano: 2025, mes: null }, hoje)).toEqual({ de: '2025-01', ate: '2025-12' });
  });
  it('um mês só; mês futuro não pede nada', () => {
    expect(mesesDoPeriodo({ ano: 2026, mes: 9 }, hoje)).toEqual({ de: '2026-09', ate: '2026-09' });
    expect(mesesDoPeriodo({ ano: 2026, mes: 11 }, hoje)).toBeNull();
    expect(mesesDoPeriodo({ ano: 2027, mes: null }, hoje)).toBeNull();
  });
  it('"todos os anos" vira os últimos 12 meses', () => {
    expect(mesesDoPeriodo({ ano: null, mes: null }, hoje)).toEqual({ de: '2025-11', ate: '2026-10' });
  });
});
