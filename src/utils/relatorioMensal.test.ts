import { describe, it, expect } from 'vitest';
import { grupoDoCargo, dadosDoRelatorio, experienciaDoMes, treinamentosDoMes } from './relatorioMensal';
import type { Vaga, Selecao, Experiencia, Integracao, Treinamento } from '../types';

const vaga = (p: Partial<Vaga>) => ({ id: 'v', codigo: 1, vaga: 'ASG', sede: 'ALDEOTA', status: 'ABERTA', setor: 'Infra', solicitacao: '', solicitante: '', ...p }) as Vaga;
const sel = (p: Partial<Selecao>) => ({ id: 's', data: '10/09/2026', cargo: 'ASG', sede: 'ALDEOTA', responsavel: '', origem: 'geral',
  convocados: 10, compareceram: 3, ausentes: 7, contratados: 0, desistiram: 1, ...p }) as Selecao;
const exp = (p: Partial<Experiencia>) => ({ id: 'e', colaborador: '', funcao: '', setor: '', sede: 'ALDEOTA', dataAdmissao: '', supervisor: '',
  status: 'EM_ANALISE', termino1: '', termino2: '', ...p }) as Experiencia;
const base = { ano: 2026, mes: 9, vagas: [], selecoes: [], experiencias: [], integracoes: [], treinamentos: [], comIntegracao: true, hojeISO: '2026-10-29' };

describe('grupoDoCargo', () => {
  it('a tabela do deck, sem acento nem caixa', () => {
    expect(grupoDoCargo('ASG')).toBe('Infraestrutura');
    expect(grupoDoCargo('Encarregado de Limpeza e Manuntenção')).toBe('Infraestrutura');
    expect(grupoDoCargo('Auxiliar de Cantina')).toBe('Atendimento');
    expect(grupoDoCargo('Agente Acadêmico de Coordenação')).toBe('Pedagógico');
    expect(grupoDoCargo('Auxiliar de Departamento Pessoal')).toBe('Administrativo');
  });
  it('prefixo só casa palavra inteira: "TMEX" não é TME, "ASB" não é ASG', () => {
    expect(grupoDoCargo('TMEX')).toBe('Seleções Gerais');
    expect(grupoDoCargo('ASB')).toBe('Seleções Gerais');
  });
  it('fora da tabela: aba pedagógica vai para Pedagógico, o resto para Seleções Gerais', () => {
    expect(grupoDoCargo('Professor(a)', 'pedagogico')).toBe('Pedagógico');
    expect(grupoDoCargo('Analista de Marketing', 'geral')).toBe('Seleções Gerais');
  });
});

describe('dadosDoRelatorio', () => {
  it('vagas: solicitadas e fechadas do mês, sem canceladas; média só das que têm tempo', () => {
    const d = dadosDoRelatorio({ ...base, vagas: [
      vaga({ solicitacao: '02/09/2026' }), vaga({ solicitacao: '03/09/2026', status: 'CANCELADA' }), vaga({ solicitacao: '30/08/2026' }),
      vaga({ status: 'FECHADA', conclusao: '15/09/2026', tempoProcesso: 40 }), vaga({ status: 'FECHADA', conclusao: '16/09/2026', tempoProcesso: 60 }),
      vaga({ status: 'FECHADA', conclusao: '17/09/2026' }), vaga({ status: 'FECHADA', conclusao: '01/10/2026', tempoProcesso: 999 }),
    ] });
    expect(d.vagas).toEqual({ solicitadas: 1, fechadas: 3, mediaDias: 50 });
  });
  it('seleções: só as realizadas do mês, somadas por cargo e por grupo; agendada vira aviso', () => {
    const d = dadosDoRelatorio({ ...base, selecoes: [
      sel({ contratados: 1 }), sel({ cargo: 'asg' }), sel({ cargo: 'Auxiliar de Cantina', convocados: 4, compareceram: 2, ausentes: 2, desistiram: 0, contratados: 2 }),
      sel({ status: 'agendado' }), sel({ data: '10/08/2026' }),
    ] });
    expect(d.selecao.total).toEqual({ convocados: 24, presentes: 8, ausentes: 16, desistentes: 2, contratados: 0 }); // marcação nas seleções não conta
    expect(d.selecao.cargos.map(c => [c.cargo, c.convocados])).toEqual([['ASG', 20], ['Auxiliar de Cantina', 4]]);
    expect(d.selecao.grupos.map(g => [g.grupo, g.total.convocados])).toEqual([['Infraestrutura', 20], ['Atendimento', 4]]);
  });
  it('contratados = vagas concluídas no mês, no grupo do cargo; grupo só com contratação também aparece', () => {
    const d = dadosDoRelatorio({ ...base, selecoes: [sel({ convocados: 5, compareceram: 2, ausentes: 3, desistiram: 0 })], vagas: [
      vaga({ vaga: 'ASG', status: 'FECHADA', conclusao: '10/09/2026' }), vaga({ vaga: 'TME', status: 'FECHADA', conclusao: '11/09/2026' }),
      vaga({ vaga: 'Assistente de RH', status: 'FECHADA', conclusao: '12/09/2026' }),
      vaga({ vaga: 'ASG', status: 'FECHADA', conclusao: '01/10/2026' }), vaga({ vaga: 'ASG', status: 'ABERTA' }),
    ] });
    expect(d.selecao.grupos.map(g => [g.grupo, g.total.convocados, g.total.contratados])).toEqual([['Infraestrutura', 5, 2], ['Administrativo', 0, 1]]);
    expect(d.selecao.total.contratados).toBe(3);
  });
  it('motivo volta na grafia da lista; o que não está nela sai com a 1ª letra maiúscula', () => {
    const d = dadosDoRelatorio({ ...base, selecoes: [sel({ desistiram: 3, motivos: { 'nao compareceu para os testes': 2, 'outro motivo': 1 } })] });
    expect(d.selecao.motivos).toEqual([{ name: 'Não compareceu para os testes', total: 2 }, { name: 'Outro motivo', total: 1 }]);
  });
  it('integração: só com a unidade que tem, pelos admitidos no mês', () => {
    const integ = [{ id: 'i', nome: '', sede: 'ALDEOTA', admissao: '05/09/2026', status: 'Realizado' }, { id: 'j', nome: '', sede: 'ALDEOTA', admissao: '06/09/2026', status: 'Não realizado' }] as Integracao[];
    expect(dadosDoRelatorio({ ...base, integracoes: integ }).integracao?.geral).toMatchObject({ total: 2, ok: 1, pct: 50 });
    expect(dadosDoRelatorio({ ...base, integracoes: integ, comIntegracao: false }).integracao).toBeNull();
  });
});

describe('experienciaDoMes', () => {
  it('pelas avaliações que venceram no mês, com o desfecho de cada período', () => {
    const [l] = experienciaDoMes([
      exp({ termino1: '05/09/2026', status: 'PRORROGADO' }),
      exp({ termino1: '06/09/2026', status: 'EFETIVADO' }),     // passou do 1º: prorrogação
      exp({ termino2: '07/09/2026', status: 'EFETIVADO' }),
      exp({ termino2: '08/09/2026', status: 'ENCERRADO', tipoEncerramento: 'a_pedido' }),
      exp({ termino1: '09/09/2026', status: 'ENCERRADO', tipoEncerramento: 'empresa' }),
      exp({ termino2: '10/09/2026', status: 'PRORROGADO' }),    // 2º venceu e não efetivou: sem desfecho
      exp({ termino1: '10/10/2026', status: 'PRORROGADO' }),    // outro mês
    ], 2026, 9, '2026-10-29');
    expect(l).toEqual({ sede: 'ALDEOTA', programadas: 6, realizadas: 5, prorrogadas: 2, efetivadas: 1, desligados: 1, pediram: 1, semDesfecho: 1, aVencer: 0 });
  });
});

describe('pontos da auditoria', () => {
  it('mês corrente: o que vence de hoje em diante é "a vencer", não pendência nem aviso', () => {
    const d = dadosDoRelatorio({ ...base, mes: 10, hojeISO: '2026-10-29', experiencias: [
      exp({ termino1: '31/10/2026' }), exp({ termino1: '29/10/2026' }), exp({ termino1: '28/10/2026' })] });
    expect(d.experiencia[0]).toMatchObject({ programadas: 3, aVencer: 2, semDesfecho: 1 });
  });
  it('cargo fora da tabela nas duas abas cai em Pedagógico em qualquer ordem', () => {
    const g = sel({ cargo: 'Auxiliar de Sala', convocados: 2, compareceram: 1, ausentes: 1, desistiram: 0 });
    const p = sel({ cargo: 'Auxiliar de Sala', origem: 'pedagogico', convocados: 10, compareceram: 5, ausentes: 5, desistiram: 0 });
    for (const ordem of [[g, p], [p, g]]) {
      expect(dadosDoRelatorio({ ...base, selecoes: ordem }).selecao.grupos.map(x => [x.grupo, x.total.convocados])).toEqual([['Pedagógico', 12]]);
    }
  });
});

describe('treinamentosDoMes', () => {
  it('o mesmo tema em várias sessões vira uma ação só', () => {
    const t = (p: Partial<Treinamento>) => ({ id: p.dataInicio === '10/10/2026' ? 'c' : p.tema ? 'b' : 'a', tema: 'Recepção que faz a diferença', dataInicio: '10/09/2026', unidade: 'PARQUE ECOLÓGICO', qtdPrevista: 15, qtdRealizada: 12, ...p }) as Treinamento;
    expect(treinamentosDoMes([t({}), t({ tema: 'recepção que faz a diferença ', qtdRealizada: 12 }), t({ dataInicio: '10/10/2026' })], 2026, 9))
      .toEqual([{ tema: 'Recepção que faz a diferença', previstos: 30, presentes: 24, turmas: 2, sedes: ['PARQUE ECOLÓGICO'], ids: ['a', 'b'] }]);
  });
});
