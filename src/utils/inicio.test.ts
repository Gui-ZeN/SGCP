import { describe, it, expect } from 'vitest';
import { pendenciasDoDia, quandoVence, fechamentoDoMes, relatoriosGerados, CHAVE_RELATORIOS_GERADOS } from './inicio';

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

describe('lembretes do relatório mensal no Início (30/10/2026)', () => {
  it('desistente sem motivo: a partir do dia seguinte, até 30 dias, só com lista de nomes', () => {
    const s = (p: any) => ({ status: 'realizado', numerosPelaLista: true, desistiram: 2, motivos: {}, ...p });
    const p = pendenciasDoDia({ ...base, selecoes: [
      s({ id: 'hoje', data: '24/09/2026' }), s({ id: 'ontem', data: '23/09/2026' }), s({ id: 'velha', data: '20/08/2026' }),
      s({ id: 'semLista', data: '23/09/2026', numerosPelaLista: false }), s({ id: 'ok', data: '23/09/2026', motivos: { a: 2 } }),
    ] });
    expect(p.desistentesSemMotivo.map(x => [x.s.id, x.quantos])).toEqual([['ontem', 2]]);
  });
  it('integração "Não realizado" de 7 a 60 dias da admissão, a mais antiga primeiro', () => {
    const i = (id: string, admissao: string, status = 'Não realizado') => ({ id, nome: id, sede: 'X', admissao, status }) as any;
    const p = pendenciasDoDia({ ...base, integracoes: [
      i('6d', '18/09/2026'), i('7d', '17/09/2026'), i('30d', '25/08/2026'), i('90d', '26/06/2026'), i('feita', '01/09/2026', 'Realizado'),
    ] });
    expect(p.integracoesPendentes.map(x => [x.i.id, x.dias])).toEqual([['30d', 30], ['7d', 7]]);
  });
});

describe('fechamentoDoMes', () => {
  it('do 1º ao 5º dia útil do mês (pula fim de semana e feriado), para o mês anterior', () => {
    // Novembro/2026: 1 dom, 2 Finados → úteis 3, 4, 5, 6, 9.
    expect(fechamentoDoMes('2026-11-03', [])).toEqual({ ano: 2026, mes: 10, ate: '09/11' });
    expect(fechamentoDoMes('2026-11-09', [])).not.toBeNull();
    expect(fechamentoDoMes('2026-11-10', [])).toBeNull();
    // Antes do 1º dia útil (domingo 1º e Finados 2) ainda não aparece.
    expect(fechamentoDoMes('2026-11-01', [])).toBeNull();
    expect(fechamentoDoMes('2026-11-02', [])).toBeNull();
  });
  it('some quando o relatório daquele mês já foi gerado; janeiro fecha dezembro do ano anterior', () => {
    expect(fechamentoDoMes('2026-11-03', ['universidade|2026-10'], ['universidade'])).toBeNull();
    expect(fechamentoDoMes('2026-11-03', ['universidade|2026-09'], ['universidade'])).not.toBeNull();
    // Administrador fecha as duas: gerar só o Colégio não apaga o lembrete da Universidade.
    expect(fechamentoDoMes('2026-11-03', ['colegio|2026-10'], ['colegio', 'universidade'])).not.toBeNull();
    expect(fechamentoDoMes('2026-11-03', ['colegio|2026-10', 'universidade|2026-10'], ['colegio', 'universidade'])).toBeNull();
    expect(fechamentoDoMes('2027-01-04', [])).toMatchObject({ ano: 2026, mes: 12 });
  });
});

describe('relatoriosGerados', () => {
  it('valor estranho no armazenamento não derruba o Início', () => {
    const guardado = globalThis.localStorage;
    const mem: Record<string, string> = { [CHAVE_RELATORIOS_GERADOS]: '[1, null, \"colegio|2026-10\"]' };
    (globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null };
    try {
      expect(relatoriosGerados()).toEqual(['colegio|2026-10']);
      mem[CHAVE_RELATORIOS_GERADOS] = '{quebrado';
      expect(relatoriosGerados()).toEqual([]);
    } finally { (globalThis as any).localStorage = guardado; }
  });
});
