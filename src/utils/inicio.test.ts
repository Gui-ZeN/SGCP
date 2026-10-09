import { describe, it, expect } from 'vitest';
import { pendenciasDoDia, quandoVence } from './inicio';

const base = { hojeISO: '2026-09-24', hojeBR: '24/09/2026', vagas: [] as any[], experiencias: [] as any[] };

describe('pendenciasDoDia', () => {
  it('separa seleção de hoje da agendada que passou sem confirmar; realizada não entra', () => {
    const selecoes: any[] = [
      { id: 'h', data: '24/09/2026', status: 'agendado' },
      { id: 'a2', data: '22/09/2026', status: 'agendado' },
      { id: 'a1', data: '20/09/2026', status: 'agendado' },
      { id: 'r', data: '23/09/2026', status: 'realizado' },
      { id: 'f', data: '30/09/2026', status: 'agendado' },
    ];
    const p = pendenciasDoDia({ ...base, selecoes });
    expect(p.selecoesHoje.map(s => s.id)).toEqual(['h']);
    expect(p.selecoesSemConfirmar.map(s => s.id)).toEqual(['a1', 'a2']);
  });

  it('avaliação: entra até 7 dias antes e até 30 dias depois do vencimento', () => {
    const experiencias: any[] = [
      { id: 'perto', status: 'EM_ANALISE', termino1: '27/09/2026' },
      { id: 'longe', status: 'EM_ANALISE', termino1: '10/10/2026' },
      { id: 'vencida', status: 'PRORROGADO', termino2: '14/09/2026' },
      { id: 'antiga', status: 'EM_ANALISE', termino1: '01/07/2026' },
      { id: 'efetivado', status: 'EFETIVADO', termino1: '24/09/2026' },
    ];
    const p = pendenciasDoDia({ ...base, experiencias });
    expect(p.avaliacoes.map(x => x.e.id)).toEqual(['vencida', 'perto']);
  });

  it('requisições só pendentes, a mais antiga primeiro; consultas só no aguardo', () => {
    const requisicoes: any[] = [
      { id: 'n', status: 'pendente', criadaEm: '2026-09-23T10:00:00Z' },
      { id: 'v', status: 'pendente', criadaEm: '2026-09-10T10:00:00Z' },
      { id: 'x', status: 'aceita', criadaEm: '2026-09-01T10:00:00Z' },
    ];
    const consultas: any[] = [{ id: 'c1', status: 'No aguardo', dataSolicitacao: '20/09/2026' }, { id: 'c2', status: 'Atendido', dataSolicitacao: '01/09/2026' }];
    const p = pendenciasDoDia({ ...base, requisicoes, consultas });
    expect(p.requisicoes.map(x => [x.r.id, x.dias])).toEqual([['v', 14], ['n', 1]]);
    expect(p.consultas.map(c => c.id)).toEqual(['c1']);
  });
});

describe('vagas fora do prazo', () => {
  it('conta dias NA ETAPA (o critério do menu e do Quadro); pausada e fechada não entram', () => {
    const hoje = new Date();
    const ha = (d: number) => new Date(hoje.getTime() - d * 86400000).toISOString();
    const vagas: any[] = [
      // aberta há muito, mas entrou na etapa há 3 dias: dentro da meta
      { id: 'recente', status: 'ABERTA', solicitacao: '01/01/2025', etapaDesde: ha(3) },
      { id: 'parada', status: 'ABERTA', solicitacao: '01/01/2025', etapaDesde: ha(40) },
      { id: 'pausada', status: 'PAUSADA', solicitacao: '01/01/2025', etapaDesde: ha(40), pausadaDesde: ha(1) },
      { id: 'fechada', status: 'FECHADA', solicitacao: '01/01/2025', etapaDesde: ha(40) },
    ];
    const p = pendenciasDoDia({ ...base, vagas });
    expect(p.vagasForaDoPrazo.map(x => [x.v.id, x.dias])).toEqual([['parada', 40]]);
  });
});

describe('quandoVence', () => {
  it('fala como gente', () => {
    expect([0, 1, 3, -1, -5].map(quandoVence)).toEqual(['vence hoje', 'vence amanhã', 'vence em 3 dias', 'venceu ontem', 'venceu há 5 dias']);
  });
});
