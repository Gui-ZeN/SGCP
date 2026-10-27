import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { admissaoPeloQuadro, codigosSequenciais, encerrada, etapasDoEditar, statusDoEditar, getDiasEmAberto, getSlaInfo, isPausedOrSuspended, normalizeEtapa, statusForEtapa, vagaAtrasada, vagasParecidas } from './vaga';
import type { Vaga } from '../types';

const vaga = (p: Partial<Vaga>) => p as Vaga;

describe('isPausedOrSuspended', () => {
  it('PAUSADA / SUSPENSA → true', () => {
    expect(isPausedOrSuspended('PAUSADA')).toBe(true);
    expect(isPausedOrSuspended('SUSPENSA')).toBe(true);
  });
  it('ABERTA / undefined → false', () => {
    expect(isPausedOrSuspended('ABERTA')).toBe(false);
    expect(isPausedOrSuspended()).toBe(false);
  });
});

describe('normalizeEtapa', () => {
  it('status DOCUMENTAÇÃO → Documentação', () => {
    expect(normalizeEtapa(vaga({ status: 'DOCUMENTAÇÃO' }))).toBe('Documentação');
  });
  it('texto de admissão → Aguardando admissão', () => {
    expect(normalizeEtapa(vaga({ etapa: 'Aguardando admissão' }))).toBe('Aguardando admissão');
  });
  it('status DOCUMENTAÇÃO com etapa de admissão → Aguardando admissão (a vaga não fica presa)', () => {
    // statusForEtapa põe status DOCUMENTAÇÃO nas duas etapas finais; se o
    // status vencesse, "Para Admissão →" mudava a etapa e o cartão não saía do lugar.
    expect(normalizeEtapa(vaga({ status: 'DOCUMENTAÇÃO', etapa: 'Aguardando admissão' }))).toBe('Aguardando admissão');
  });
  it('texto de documentação/contratação → Documentação', () => {
    expect(normalizeEtapa(vaga({ etapa: 'Contratação / Docs' }))).toBe('Documentação');
  });
  it('texto de teste → Testes', () => {
    expect(normalizeEtapa(vaga({ etapa: 'Testes psicológicos' }))).toBe('Testes');
  });
  it('texto de entrevista → Entrevista', () => {
    expect(normalizeEtapa(vaga({ etapa: 'Entrevista com gestor' }))).toBe('Entrevista');
  });
  it('desconhecido → Triagem', () => {
    expect(normalizeEtapa(vaga({ etapa: 'qualquer coisa' }))).toBe('Triagem');
  });
});

describe('statusForEtapa (sincroniza Por etapa → Por status)', () => {
  it('etapas de doc/admissão → DOCUMENTAÇÃO', () => {
    expect(statusForEtapa('ABERTA', 'Documentação')).toBe('DOCUMENTAÇÃO');
    expect(statusForEtapa('ABERTA', 'Aguardando admissão')).toBe('DOCUMENTAÇÃO');
    expect(statusForEtapa('REABERTA', 'Documentação')).toBe('DOCUMENTAÇÃO');
  });
  it('regredir de doc para etapa inicial → ABERTA', () => {
    expect(statusForEtapa('DOCUMENTAÇÃO', 'Testes')).toBe('ABERTA');
  });
  it('sem mudança necessária → undefined', () => {
    expect(statusForEtapa('ABERTA', 'Entrevista')).toBeUndefined();
    expect(statusForEtapa('DOCUMENTAÇÃO', 'Documentação')).toBeUndefined();
  });
  it('não mexe em pausada/suspensa/fechada', () => {
    expect(statusForEtapa('PAUSADA', 'Documentação')).toBeUndefined();
    expect(statusForEtapa('SUSPENSA', 'Triagem')).toBeUndefined();
    expect(statusForEtapa('FECHADA', 'Triagem')).toBeUndefined();
  });
});

describe('getSlaInfo (faixas 10 / meta 15)', () => {
  it('<= 10 → Regular', () => {
    expect(getSlaInfo(10, false, false).label).toBe('SLA Regular');
  });
  it('11–15 → Alerta', () => {
    expect(getSlaInfo(13, false, false).label).toBe('SLA Alerta');
    expect(getSlaInfo(15, false, false).label).toBe('SLA Alerta');
  });
  it('> 15 → Crítico', () => {
    expect(getSlaInfo(20, false, false).label).toBe('SLA Crítico');
  });
  it('pausada → Pausado (independe dos dias)', () => {
    expect(getSlaInfo(99, false, true).label).toBe('SLA Pausado');
  });
});

describe('getDiasEmAberto (com congelamento de pausa)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 12, 0, 0)); // 16/06/2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('FECHADA → tempoProcesso', () => {
    expect(getDiasEmAberto(vaga({ status: 'FECHADA', tempoProcesso: 42 }))).toBe(42);
  });
  it('aberta: hoje − solicitação', () => {
    expect(getDiasEmAberto(vaga({ status: 'ABERTA', solicitacao: '01/06/2026' }))).toBe(15);
  });
  it('desconta diasPausados acumulados', () => {
    expect(getDiasEmAberto(vaga({ status: 'ABERTA', solicitacao: '01/06/2026', diasPausados: 5 }))).toBe(10);
  });
  it('pausada desde a abertura → congela em 0', () => {
    expect(getDiasEmAberto(vaga({ status: 'PAUSADA', solicitacao: '10/06/2026', pausadaDesde: '2026-06-10' }))).toBe(0);
  });
  it('solicitação inválida → 0', () => {
    expect(getDiasEmAberto(vaga({ status: 'ABERTA', solicitacao: '' }))).toBe(0);
  });
});

describe('codigosSequenciais', () => {
  it('continua de onde o banco parou', () => {
    expect(codigosSequenciais([{ codigo: 1007 }, { codigo: 1003 }], 1)).toEqual([1008]);
  });

  it('um lote de 30 sai com 30 códigos DIFERENTES e seguidos', () => {
    // O defeito que este teste segura: chamar "abre uma vaga" 30 vezes num laço
    // lê o mesmo máximo nas 30 vezes (o estado só muda quando o snapshot volta)
    // e cria 30 vagas com o mesmo código. Foi o caso real da Coordenadora,
    // abrindo 30 temporários de lojinha.
    const codigos = codigosSequenciais([{ codigo: 2000 }], 30);
    expect(codigos).toHaveLength(30);
    expect(new Set(codigos).size).toBe(30);
    expect(codigos[0]).toBe(2001);
    expect(codigos[29]).toBe(2030);
  });

  it('banco vazio começa em 1001', () => {
    expect(codigosSequenciais([], 2)).toEqual([1001, 1002]);
  });

  it('quantidade inválida não inventa vaga', () => {
    expect(codigosSequenciais([{ codigo: 5 }], 0)).toEqual([]);
    expect(codigosSequenciais([{ codigo: 5 }], -3)).toEqual([]);
    expect(codigosSequenciais([{ codigo: 5 }], NaN)).toEqual([]);
  });
});

describe('vaga cancelada', () => {
  it('é encerrada, como a fechada', () => {
    expect(encerrada('CANCELADA')).toBe(true);
    expect(encerrada('FECHADA')).toBe(true);
    expect(encerrada('SUSPENSA')).toBe(false);
  });
  it('nunca conta como atrasada, por mais antiga que seja', () => {
    expect(vagaAtrasada(vaga({ status: 'CANCELADA', etapaDesde: '2020-01-01', solicitacao: '01/01/2020' }))).toBe(false);
  });
  it('mudar a etapa não mexe no status', () => {
    expect(statusForEtapa('CANCELADA', 'Documentação')).toBeUndefined();
  });
  it('não é vaga parecida (não avisa ao abrir outra para o mesmo substituído)', () => {
    expect(vagasParecidas({ vaga: 'ASG', sede: 'PE', solicitante: 'X', funcionarioSubstituido: 'Ana Lima' }, [vaga({ status: 'CANCELADA', funcionarioSubstituido: 'Ana Lima' })])).toEqual([]);
  });
});

describe('admissaoPeloQuadro', () => {
  it('pausada ou suspensa passa pelo funil (e termina em DOCUMENTAÇÃO — o quadro força o status)', () => {
    expect(admissaoPeloQuadro(vaga({ status: 'PAUSADA', etapa: 'Triagem' }))).toBe('funil');
    expect(admissaoPeloQuadro(vaga({ status: 'SUSPENSA', etapa: 'Entrevista' }))).toBe('funil');
  });
  it('fechada ou cancelada não vai (antes o arraste reabria a concluída)', () => {
    expect(admissaoPeloQuadro(vaga({ status: 'FECHADA', etapa: 'Processo Concluído' }))).toBe('encerrada');
    expect(admissaoPeloQuadro(vaga({ status: 'CANCELADA' }))).toBe('encerrada');
  });
  it('já na etapa de documentação com status atrás: só acerta o status', () => {
    expect(admissaoPeloQuadro(vaga({ status: 'ABERTA', etapa: 'Entrega de documentação' }))).toBe('so-status');
    expect(admissaoPeloQuadro(vaga({ status: 'ABERTA', etapa: 'Triagem de currículos' }))).toBe('funil');
  });
});

describe('statusDoEditar (o Status também não cruza a documentação)', () => {
  it('vaga aberta não oferece DOCUMENTAÇÃO', () => {
    expect(statusDoEditar('ABERTA')).toEqual(['ABERTA', 'REABERTA', 'SUSPENSA', 'PAUSADA', 'FECHADA', 'CANCELADA']);
  });
  it('vaga em documentação não volta para ABERTA/REABERTA pelo Editar', () => {
    expect(statusDoEditar('DOCUMENTAÇÃO')).toEqual(['DOCUMENTAÇÃO', 'SUSPENSA', 'PAUSADA', 'FECHADA', 'CANCELADA']);
  });
  it('pausada ou fechada reabrem como ABERTA, não direto em DOCUMENTAÇÃO', () => {
    expect(statusDoEditar('PAUSADA')).not.toContain('DOCUMENTAÇÃO');
    expect(statusDoEditar('FECHADA')).toContain('ABERTA');
  });
});

describe('etapasDoEditar', () => {
  it('vaga aberta não oferece Documentação (cruzar é pelo Quadro, com o funil)', () => {
    expect(etapasDoEditar('ABERTA', 'Triagem')).toEqual(['Triagem', 'Entrevista', 'Testes']);
  });
  it('vaga em documentação não oferece voltar para Triagem (o Quadro pede o motivo)', () => {
    expect(etapasDoEditar('DOCUMENTAÇÃO', 'Documentação')).toEqual(['Documentação', 'Aguardando admissão']);
  });
  it('a etapa atual nunca some, mesmo do outro lado', () => {
    expect(etapasDoEditar('ABERTA', 'Documentação')).toEqual(['Triagem', 'Entrevista', 'Testes', 'Documentação']);
  });
});

describe('vagasParecidas', () => {
  const v = (p: Partial<Vaga>) => ({ status: 'ABERTA', vaga: 'ASG', sede: 'DOM LUÍS', solicitante: 'João Victor', ...p }) as Vaga;
  it('mesmo substituído em vaga aberta → avisa, mesmo com o cargo escrito diferente', () => {
    const lista = [v({ id: 'a', vaga: 'Agente Acadêmico de Coordenação', funcionarioSubstituido: 'Verônica Daniele Albuquerque' })];
    expect(vagasParecidas({ vaga: 'Agente de Coordenação Acadêmico', sede: 'EUSEBIO', solicitante: 'X', funcionarioSubstituido: 'veronica daniele' }, lista).map(x => x.id)).toEqual(['a']);
  });
  it('vaga FECHADA não conta (substituir de novo a mesma pessoa é outra vaga)', () => {
    const lista = [v({ status: 'FECHADA', funcionarioSubstituido: 'Gilberto Maciel' })];
    expect(vagasParecidas({ vaga: 'ASG', sede: 'DOM LUÍS', solicitante: 'João', funcionarioSubstituido: 'Gilberto Maciel de Oliveira' }, lista)).toEqual([]);
  });
  it('pausada ou suspensa conta: ela volta e vira duas', () => {
    expect(vagasParecidas({ vaga: 'ASG', sede: 'DOM LUÍS', solicitante: 'João', funcionarioSubstituido: 'Dulce Maria' }, [v({ status: 'SUSPENSA', funcionarioSubstituido: 'Dulce Maria da Silva' })])).toHaveLength(1);
  });
  it('sem substituído: só com o mesmo cargo, sede e solicitante', () => {
    const lista = [v({ id: 'a' }), v({ id: 'b', sede: 'ALDEOTA' }), v({ id: 'c', solicitante: 'Rayanne' })];
    expect(vagasParecidas({ vaga: 'asg ', sede: 'Dom Luís', solicitante: 'joão victor ', funcionarioSubstituido: '' }, lista).map(x => x.id)).toEqual(['a']);
  });
  it('mesmo prenome, sobrenome diferente: pessoas diferentes', () => {
    const lista = [v({ funcionarioSubstituido: 'Maria Eduarda Oliveira Silva' })];
    expect(vagasParecidas({ vaga: 'Auxiliar de Cantina', sede: 'PE', solicitante: 'X', funcionarioSubstituido: 'Maria Eduarda de Oliveira Costa' }, lista)).toEqual([]);
  });
  it('só o prenome casa só com o mesmo prenome sozinho', () => {
    const lista = [v({ id: 'a', funcionarioSubstituido: 'Josué' }), v({ id: 'b', funcionarioSubstituido: 'Josué Lima' })];
    expect(vagasParecidas({ vaga: 'ASG', sede: 'PE', solicitante: 'X', funcionarioSubstituido: 'josue' }, lista).map(x => x.id)).toEqual(['a']);
  });
  it('nome gravado pela rota externa, com " (matrícula 77)", ainda casa', () => {
    expect(vagasParecidas({ vaga: 'ASG', sede: 'SUL 2', solicitante: 'X', funcionarioSubstituido: 'Gilberto Maciel de Oliveira' }, [v({ funcionarioSubstituido: 'Gilberto Maciel (matrícula 77)' })])).toHaveLength(1);
  });
  it('o aviso não pisca enquanto o RH digita o sobrenome', () => {
    const lista = [v({ funcionarioSubstituido: 'Maria Eduarda Silva' })];
    for (const digitado of ['Maria Eduarda', 'Maria Eduarda S', 'Maria Eduarda Sil', 'Maria Eduarda Silva']) {
      expect(vagasParecidas({ vaga: 'ASG', sede: 'PE', solicitante: 'X', funcionarioSubstituido: digitado }, lista)).toHaveLength(1);
    }
    expect(vagasParecidas({ vaga: 'ASG', sede: 'PE', solicitante: 'X', funcionarioSubstituido: 'Maria Eduarda C' }, lista)).toEqual([]);
  });
  it('substituído diferente não avisa', () => {
    expect(vagasParecidas({ vaga: 'ASG', sede: 'DOM LUÍS', solicitante: 'João Victor', funcionarioSubstituido: 'Paulo Cesar' }, [v({ funcionarioSubstituido: 'Gilberto Maciel' })])).toEqual([]);
  });
});
