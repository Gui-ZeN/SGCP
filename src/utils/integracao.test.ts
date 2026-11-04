import { describe, it, expect } from 'vitest';
import { integracaoDaVaga, integracaoAoEditar, jaNaIntegracao } from './integracao';

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

describe('integracaoAoEditar', () => {
  const vaga = { vaga: 'ASG', setor: 'Infra', sede: 'SUL', solicitante: 'Sup', codigo: 7, status: 'FECHADA', aprovado: '' } as any;
  it('aprovado preenchido depois em vaga já concluída: cria, sem data de admissão', () => {
    expect(integracaoAoEditar(vaga, { aprovado: ' Ana Lima ' }, [])).toMatchObject({ nome: 'Ana Lima', sede: 'SUL', admissao: '', status: 'Não realizado', observacao: 'Veio da vaga nº 7.' });
  });
  it('concluída pelo Status, com o aprovado que já estava na vaga: cria', () => {
    expect(integracaoAoEditar({ ...vaga, status: 'DOCUMENTAÇÃO', aprovado: 'Ana Lima' }, { status: 'FECHADA' }, [])?.nome).toBe('Ana Lima');
  });
  it('já na Integração (sem acento nem caixa), sem aprovado, ou vaga não concluída: não cria', () => {
    expect(integracaoAoEditar(vaga, { aprovado: 'ANA LIMÁ' }, [{ nome: 'Ana Lima' }])).toBeNull();
    expect(integracaoAoEditar(vaga, { aprovado: '  ' }, [])).toBeNull();
    expect(integracaoAoEditar({ ...vaga, status: 'ABERTA' }, { aprovado: 'Ana Lima' }, [])).toBeNull();
    expect(integracaoAoEditar(vaga, { status: 'REABERTA', aprovado: 'Ana Lima' }, [])).toBeNull();
  });
});
