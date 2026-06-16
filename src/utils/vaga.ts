/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Helpers de domínio da Vaga centralizados — cálculo de dias em aberto/SLA (com
 * congelamento durante pausas), faixas de SLA, e o funil de etapas. Antes estavam
 * duplicados/divergentes entre VacancyTable, HomeSection e Dashboard.
 */

import { Vaga } from '../types';
import { SLA_META_DIAS } from '../constants/hr';

/** Parse de data no formato BR (DD/MM/YYYY). Retorna null se inválida. */
export function parseDateDDMMYYYY(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return null;
}

export function isPausedOrSuspended(status?: string): boolean {
  return ['PAUSADA', 'SUSPENSA'].includes((status || '').toUpperCase());
}

/**
 * Dias que a vaga está em aberto, descontando o tempo pausado (SLA congela
 * durante pausas): subtrai os dias já pausados (diasPausados) e, se estiver
 * pausada agora, também a pausa atual (hoje - pausadaDesde).
 */
export function getDiasEmAberto(vaga: Vaga): number {
  if (vaga.status === 'FECHADA') {
    return vaga.tempoProcesso || 0;
  }
  const dateSol = parseDateDDMMYYYY(vaga.solicitacao);
  if (!dateSol) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateSol.setHours(0, 0, 0, 0);
  let diffDays = Math.floor((today.getTime() - dateSol.getTime()) / 86400000);
  diffDays -= (vaga.diasPausados || 0);
  if (isPausedOrSuspended(vaga.status) && vaga.pausadaDesde) {
    const ini = new Date(vaga.pausadaDesde);
    if (!isNaN(ini.getTime())) {
      ini.setHours(0, 0, 0, 0);
      diffDays -= Math.max(0, Math.floor((today.getTime() - ini.getTime()) / 86400000));
    }
  }
  return diffDays < 0 ? 0 : diffDays;
}

export interface SlaInfo {
  label: string;
  color: string;
  bullet: string;
  progressBar: string;
  percent: number;
  desc: string;
}

/** Faixas de SLA: pausado (cinza) · <=10 regular · <=meta(15) alerta · >meta crítico. */
export function getSlaInfo(days: number, isClosed: boolean, isPaused = false): SlaInfo {
  if (isPaused) {
    return {
      label: 'SLA Pausado',
      color: 'text-slate-600 bg-slate-100 border-slate-200',
      bullet: 'bg-slate-400',
      progressBar: 'bg-slate-300',
      percent: Math.min(100, Math.max(8, (days / 30) * 100)),
      desc: 'Processo temporariamente paralisado; SLA sem alerta ativo.'
    };
  }

  if (days <= 10) {
    return {
      label: 'SLA Regular',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      bullet: 'bg-emerald-500',
      progressBar: 'bg-emerald-500',
      percent: Math.min(100, (days / 15) * 100),
      desc: isClosed ? 'Processo rápido' : 'Vaga recente, sem riscos de SLA.'
    };
  } else if (days <= SLA_META_DIAS) {
    return {
      label: 'SLA Alerta',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      bullet: 'bg-amber-500',
      progressBar: 'bg-amber-500',
      percent: Math.min(100, (days / SLA_META_DIAS) * 100),
      desc: isClosed ? 'Preenchida no limite' : 'Processo correndo no tempo limite.'
    };
  } else {
    return {
      label: 'SLA Crítico',
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      bullet: 'bg-rose-500',
      progressBar: 'bg-rose-500',
      percent: 100,
      desc: isClosed ? 'Excedeu tempo ideal' : 'Tempo crítico! Esta vaga necessita atenção urgente.'
    };
  }
}

// ===== Funil de etapas (Kanban "Por etapa") =====
/** Funil fixo de etapas, em ordem (índice = posição no processo). */
export const ETAPAS_FUNIL = ['Triagem', 'Entrevista', 'Testes', 'Documentação', 'Aguardando admissão'] as const;

// Etapas do funil que correspondem ao status "DOCUMENTAÇÃO" (fase de admissão/doc).
const ETAPAS_DOC = ['Documentação', 'Aguardando admissão'];

/**
 * Status que a vaga deveria ter ao chegar numa etapa do funil — para manter o
 * Kanban "Por status" coerente com o "Por etapa". Devolve o novo status, ou
 * undefined quando nada deve mudar. NÃO mexe em PAUSADA/SUSPENSA/FECHADA.
 */
export function statusForEtapa(currentStatus: string | undefined, novaEtapa: string): Vaga['status'] | undefined {
  const cur = (currentStatus || '').toUpperCase();
  if (cur === 'PAUSADA' || cur === 'SUSPENSA' || cur === 'FECHADA') return undefined;
  if (ETAPAS_DOC.includes(novaEtapa)) {
    return cur === 'DOCUMENTAÇÃO' ? undefined : 'DOCUMENTAÇÃO';
  }
  // Etapas iniciais (Triagem/Entrevista/Testes): volta a ABERTA se estava em doc.
  return cur === 'DOCUMENTAÇÃO' ? 'ABERTA' : undefined;
}

/** Mapeia a etapa (texto livre nas vagas antigas) para uma etapa do funil. */
export function normalizeEtapa(vaga: Vaga): string {
  if (vaga.status === 'DOCUMENTAÇÃO') return 'Documentação';
  const e = (vaga.etapa || '').toLowerCase();
  if (e.includes('admiss')) return 'Aguardando admissão';
  if (e.includes('doc') || e.includes('exame') || e.includes('contrat') || e.includes('carteira')) return 'Documentação';
  if (e.includes('teste') || e.includes('psico') || e.includes('avalia')) return 'Testes';
  if (e.includes('entrevista')) return 'Entrevista';
  return 'Triagem';
}

/**
 * Dias na etapa atual. Usa etapaDesde quando existe (congelando a pausa atual);
 * senão cai no tempo total em aberto (vagas antigas sem data por etapa).
 */
export function diasNestaEtapa(vaga: Vaga): number {
  if (vaga.etapaDesde) {
    const d = new Date(vaga.etapaDesde);
    if (!isNaN(d.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      let dias = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (isPausedOrSuspended(vaga.status) && vaga.pausadaDesde) {
        const ini = new Date(vaga.pausadaDesde);
        if (!isNaN(ini.getTime())) {
          ini.setHours(0, 0, 0, 0);
          dias -= Math.max(0, Math.floor((today.getTime() - ini.getTime()) / 86400000));
        }
      }
      return Math.max(0, dias);
    }
  }
  return getDiasEmAberto(vaga);
}
