/** O aviso da tela de Experiência diz o prazo da unidade do registro (04/11/2026). */
import { describe, it, expect } from 'vitest';
import { getReviewAlert } from './ExperienciasSection';

const prorrogado = (escopo: 'universidade' | 'colegio', termino2: string) =>
  ({ id: 'x', status: 'PRORROGADO', escopo, termino1: '', termino2 }) as any;

describe('getReviewAlert', () => {
  it('atrasado: 75 dias na Universidade, 90 no Colégio', () => {
    const uni = getReviewAlert(prorrogado('universidade', '01/01/2020'));
    expect(uni.label).toBe('Atrasado (75d)');
    expect(uni.message).toContain('Avaliação final de 75 dias');
    const col = getReviewAlert(prorrogado('colegio', '01/01/2020'));
    expect(col.label).toBe('Atrasado (90d)');
    expect(col.message).toContain('Avaliação final de 90 dias');
  });
});
