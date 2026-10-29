import { describe, it, expect } from 'vitest';
import { integracaoDaVaga, jaNaIntegracao } from './integracao';

describe('integracaoDaVaga', () => {
  it('nome, cargo, setor, sede, admissão e o gestor como supervisor; entra como Não realizado', () => {
    const v = { vaga: 'ASG', setor: 'Infraestrutura', sede: 'DIONISIO TORRES', solicitante: 'Coord. Infra', codigo: 2147181020 };
    expect(integracaoDaVaga(v, ' Ana Lima ', '03/11/2026')).toEqual({
      nome: 'Ana Lima', funcao: 'ASG', setor: 'Infraestrutura', sede: 'DIONISIO TORRES', admissao: '03/11/2026',
      supervisor: 'Coord. Infra', status: 'Não realizado', observacao: 'Veio da vaga nº 2147181020.',
    });
  });
});

describe('jaNaIntegracao', () => {
  it('casa pelo nome sem acento, caixa ou espaço a mais; nome vazio nunca casa', () => {
    const lista = [{ nome: 'José  Lima' }];
    expect(jaNaIntegracao('jose lima', lista)).toBe(true);
    expect(jaNaIntegracao('José Lima Filho', lista)).toBe(false);
    expect(jaNaIntegracao('  ', [{ nome: '' }])).toBe(false);
  });
});
