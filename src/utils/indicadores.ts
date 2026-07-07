import type { Integracao, Treinamento, Experiencia } from '../types';

/**
 * Agregações "por sede, com % de cumprimento" — reproduzem o relatório mensal
 * de indicadores do RH (Integração, Experiência e Treinamentos por campus).
 * Funções PURAS e testáveis; a UI (aba Relatório) só renderiza.
 */

export interface CumprimentoSede {
  sede: string;
  total: number;   // programados / previstos
  ok: number;      // realizados / treinados / com desfecho
  pct: number;     // ok/total × 100 (0 se total 0), arredondado
  detalhe: Record<string, number>; // quebras extras (desligados, prorrogados…)
}

const pct = (ok: number, total: number) => (total > 0 ? Math.round((ok / total) * 100) : 0);
const nomeSede = (s?: string) => (s || '').trim() || '—';

/** Ordena por volume (total desc) e desempata por nome — como o deck lista os campi. */
function ordenar(linhas: CumprimentoSede[]): CumprimentoSede[] {
  return [...linhas].sort((a, b) => b.total - a.total || a.sede.localeCompare(b.sede, 'pt-BR'));
}

/** Integração: programados = total; realizados = status "Realizado". */
export function integracaoPorSede(list: Integracao[]): CumprimentoSede[] {
  const map = new Map<string, CumprimentoSede>();
  for (const i of list) {
    const sede = nomeSede(i.sede);
    const l = map.get(sede) || { sede, total: 0, ok: 0, pct: 0, detalhe: { realizados: 0, naoRealizados: 0, desligados: 0 } };
    l.total++;
    if (i.status === 'Realizado') { l.ok++; l.detalhe.realizados++; }
    else if (i.status === 'Desligado') l.detalhe.desligados++;
    else l.detalhe.naoRealizados++;
    map.set(sede, l);
  }
  return ordenar([...map.values()].map(l => ({ ...l, pct: pct(l.ok, l.total) })));
}

/** Treinamentos: previstos = Σ qtdPrevista; treinados = Σ qtdRealizada (agrupado por unidade/campus). */
export function treinamentoPorSede(list: Treinamento[]): CumprimentoSede[] {
  const map = new Map<string, CumprimentoSede>();
  for (const t of list) {
    const sede = nomeSede(t.unidade);
    const l = map.get(sede) || { sede, total: 0, ok: 0, pct: 0, detalhe: { turmas: 0 } };
    l.total += Number(t.qtdPrevista) || 0;
    l.ok += Number(t.qtdRealizada) || 0;
    l.detalhe.turmas++;
    map.set(sede, l);
  }
  return ordenar([...map.values()].map(l => ({ ...l, pct: pct(l.ok, l.total) })));
}

/**
 * Experiência: programadas = total; "com desfecho" (ok) = efetivadas + prorrogadas
 * + desligadas (tudo que não está mais EM_ANALISE). Detalhe traz cada status.
 */
export function experienciaPorSede(list: Experiencia[]): CumprimentoSede[] {
  const map = new Map<string, CumprimentoSede>();
  for (const e of list) {
    const sede = nomeSede(e.sede);
    const l = map.get(sede) || { sede, total: 0, ok: 0, pct: 0, detalhe: { emAnalise: 0, prorrogadas: 0, efetivadas: 0, desligadas: 0 } };
    l.total++;
    if (e.status === 'EM_ANALISE') l.detalhe.emAnalise++;
    else {
      l.ok++;
      if (e.status === 'PRORROGADO') l.detalhe.prorrogadas++;
      else if (e.status === 'EFETIVADO') l.detalhe.efetivadas++;
      else if (e.status === 'ENCERRADO') l.detalhe.desligadas++;
    }
    map.set(sede, l);
  }
  return ordenar([...map.values()].map(l => ({ ...l, pct: pct(l.ok, l.total) })));
}

/** Soma uma coluna "GERAL" (todas as sedes) a partir das linhas por sede. */
export function totalGeral(linhas: CumprimentoSede[]): CumprimentoSede {
  const total = linhas.reduce((s, l) => s + l.total, 0);
  const ok = linhas.reduce((s, l) => s + l.ok, 0);
  const detalhe: Record<string, number> = {};
  for (const l of linhas) for (const [k, v] of Object.entries(l.detalhe)) detalhe[k] = (detalhe[k] || 0) + v;
  return { sede: 'GERAL', total, ok, pct: pct(ok, total), detalhe };
}
