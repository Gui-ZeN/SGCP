import { describe, it, expect } from 'vitest';
import { requisicaoParaVaga } from './requisicao';
import type { Requisicao } from '../types';

const base: Requisicao = {
  id: 'r1',
  criadaEm: '2026-06-10T12:00:00.000Z',
  cargo: 'Auxiliar Administrativo',
  sede: 'DIONISIO TORRES',
  setor: 'Financeiro',
  selecao: 'Externa',
  tipoContratacao: 'Ampliação do Quadro de Pessoal',
  gestorSolicitante: 'Maria Gestora',
  status: 'pendente',
};

describe('requisicaoParaVaga', () => {
  it('mapeia os campos principais e defaults', () => {
    const v = requisicaoParaVaga(base);
    expect(v.vaga).toBe('Auxiliar Administrativo');
    expect(v.sede).toBe('DIONISIO TORRES');
    expect(v.setor).toBe('Financeiro');
    expect(v.status).toBe('ABERTA');
    expect(v.etapa).toBe('Triagem');
    expect(v.solicitante).toBe('Maria Gestora');
    expect(v.motivo).toBe('Ampliação do Quadro de Pessoal');
    expect(v.categoria).toBe('Requisição');
  });

  it('setor vazio → "Geral"', () => {
    expect(requisicaoParaVaga({ ...base, setor: '' }).setor).toBe('Geral');
  });

  it('solicitação vem da criadaEm (dd/mm/aaaa)', () => {
    expect(requisicaoParaVaga(base).solicitacao).toMatch(/10\/06\/2026/);
  });

  it('criadaEm inválida → usa a data de agora', () => {
    const agora = new Date(2026, 5, 24);
    expect(requisicaoParaVaga({ ...base, criadaEm: 'nada' }, agora).solicitacao)
      .toBe(agora.toLocaleDateString('pt-BR'));
  });

  it('campos extras vão para observações (só os preenchidos)', () => {
    const v = requisicaoParaVaga({
      ...base,
      justificativa: 'Time sobrecarregado',
      hardSkills: 'Excel avançado',
      gestorEmail: 'maria@christus.com.br',
    });
    expect(v.observacoes).toContain('Justificativa: Time sobrecarregado');
    expect(v.observacoes).toContain('Hard skills: Excel avançado');
    expect(v.observacoes).toContain('Contato do gestor: maria@christus.com.br');
    expect(v.observacoes).not.toContain('Jornada');    // vazio não entra
    expect(v.observacoes).toContain('Origem: requisição (Ampliação do Quadro de Pessoal).');
  });
});

describe('requisicaoParaVaga: pedido do Orkestria', () => {
  const pedido = {
    id: 'orkestria_c1', cargo: 'ASG', sede: 'SUL', setor: 'Infraestrutura', gestorSolicitante: 'Sup', status: 'pendente', criadaEm: '2026-11-04T16:00:00Z',
    selecao: 'Externa', tipoContratacao: 'Substituição por desligamento', origem: 'orkestria', origemCaso: 'c1', escopo: 'colegio', vagaCodigo: 2147181050,
    funcionarioSubstituido: 'Fulano (matrícula 7)', observacoes: 'Pedida pelo Orkestria (caso c1) — Acordo.', solicitacao: '04/11/2026', mesSolicitacao: 'Nov', ano: 2026,
    categoria: 'Seleções Gerais', categoriaMotivo: 'Substituição',
  } as any;
  it('sai como a vaga da rota: substituído, origem, unidade e a data do pedido; os dias na etapa contam do aceite', () => {
    const v = requisicaoParaVaga(pedido, new Date(2026, 10, 6, 12));
    expect(v).toMatchObject({
      vaga: 'ASG', sede: 'SUL', setor: 'Infraestrutura', status: 'ABERTA', solicitante: 'Sup', solicitacao: '04/11/2026', mesSolicitacao: 'Nov', ano: 2026,
      motivo: 'Substituição por desligamento', categoriaMotivo: 'Substituição', categoria: 'Seleções Gerais', funcionarioSubstituido: 'Fulano (matrícula 7)',
      etapa: 'Triagem de currículos', etapaDesde: '2026-11-06', observacoes: 'Pedida pelo Orkestria (caso c1) — Acordo.', origem: 'orkestria', escopo: 'colegio', responsavel: 'RH',
    });
    expect((v as any).status).not.toBe('pendente');
  });
  it('requisição do formulário continua como sempre (sem origem)', () => {
    const v = requisicaoParaVaga({ ...pedido, origem: undefined, justificativa: 'J' }, new Date(2026, 10, 6, 12));
    expect(v.categoria).toBe('Requisição');
    expect(v.observacoes).toContain('Justificativa: J');
  });
});
