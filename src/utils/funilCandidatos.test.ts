import { describe, expect, it } from 'vitest';
import type { Candidato, Selecao } from '../types';
import { candidatosDaVaga, listaParaDocumentacao, listaParaTestes, naDocumentacao, presenca, veio } from './funilCandidatos';

const sel = (id: string, vagaIds: string[]): Selecao => ({
  id, data: '10/10/2026', cargo: 'ASG', sede: 'DT', origem: 'geral', convocados: 0, compareceram: 0,
  ausentes: 0, desistiram: 0, contratados: 0, vagaIds,
} as Selecao);
const cand = (id: string, selecaoId: string, extra: Partial<Candidato> = {}): Candidato => ({
  id, selecaoId, data: '10/10/2026', nome: id, resultado: 'convocado', ...extra,
});

describe('funil de candidatos da vaga', () => {
  const selecoes = [sel('s1', ['vA', 'vB']), sel('s2', ['vC'])];
  const candidatos = [
    cand('Ana', 's1', { resultado: 'compareceu' }),
    cand('Bia', 's1', { resultado: 'ausente' }),
    cand('Caio', 's1', { resultado: 'aprovado', etapa: 'testes' }),
    cand('Davi', 's1', { resultado: 'aprovado', etapa: 'documentacao', vagaId: 'vB' }),
    cand('Eva', 's2', { resultado: 'compareceu' }),
    cand('Fred', 's1', { resultado: 'risco', etapa: 'testes' }),
  ];
  const daA = candidatosDaVaga({ id: 'vA' }, selecoes, candidatos);

  it('pega só os candidatos das seleções ligadas à vaga', () => {
    expect(daA.map(c => c.nome)).toEqual(['Ana', 'Bia', 'Caio', 'Davi', 'Fred']);
    expect(daA[0].selecao.id).toBe('s1');
  });

  it('presença: ausente não conta como compareceu, sem resultado também não', () => {
    expect(presenca([...daA, cand('Gil', 's1')])).toEqual({ convocados: 6, compareceram: 4, ausentes: 1, semResultado: 1 });
    expect(veio({ resultado: 'convocado' })).toBe(false);
  });

  it('quem já seguiu para a documentação de OUTRA vaga sai das listas desta', () => {
    expect(listaParaTestes(daA, 'vA').map(c => c.nome)).not.toContain('Davi');
    expect(listaParaTestes(daA, 'vB').map(c => c.nome)).toContain('Davi');
  });

  it('documentação: quem está em testes; pulando os testes, quem veio e não saiu', () => {
    expect(listaParaDocumentacao(daA, 'vA', false).map(c => c.nome)).toEqual(['Caio', 'Fred']);
    expect(listaParaDocumentacao(daA, 'vA', true).map(c => c.nome)).toEqual(['Ana', 'Caio', 'Fred']);
  });

  it('o nome que o Concluir sugere é o da documentação DESTA vaga', () => {
    expect(naDocumentacao(daA, 'vB').map(c => c.nome)).toEqual(['Davi']);
    expect(naDocumentacao(daA, 'vA')).toEqual([]);
  });
});
