import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDiasEmAberto, getSlaInfo, isPausedOrSuspended, normalizeEtapa, statusForEtapa } from './vaga';
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
