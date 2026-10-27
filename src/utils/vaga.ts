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
import { normalizarNome } from './catalogo';

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

/**
 * Fechada ou cancelada: a vaga saiu do processo. Cancelada (27/10/2026) não é
 * concluída — fica fora dos indicadores e do quadro, num canto à parte.
 */
export function encerrada(status?: string): boolean {
  return ['FECHADA', 'CANCELADA'].includes((status || '').toUpperCase());
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
 * undefined quando nada deve mudar. NÃO mexe em PAUSADA/SUSPENSA/FECHADA/CANCELADA.
 */
export function statusForEtapa(currentStatus: string | undefined, novaEtapa: string): Vaga['status'] | undefined {
  const cur = (currentStatus || '').toUpperCase();
  if (cur === 'PAUSADA' || cur === 'SUSPENSA' || encerrada(cur)) return undefined;
  if (ETAPAS_DOC.includes(novaEtapa)) {
    return cur === 'DOCUMENTAÇÃO' ? undefined : 'DOCUMENTAÇÃO';
  }
  // Etapas iniciais (Triagem/Entrevista/Testes): volta a ABERTA se estava em doc.
  return cur === 'DOCUMENTAÇÃO' ? 'ABERTA' : undefined;
}

/** Mapeia a etapa (texto livre nas vagas antigas) para uma etapa do funil. */
export function normalizeEtapa(vaga: Vaga): string {
  const e = (vaga.etapa || '').toLowerCase();
  // ⚠️ Admissão ANTES do status: as duas etapas finais têm status DOCUMENTAÇÃO,
  // e com o status primeiro a vaga nunca chegava a "Aguardando admissão".
  if (e.includes('admiss')) return 'Aguardando admissão';
  if (vaga.status === 'DOCUMENTAÇÃO') return 'Documentação';
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

/**
 * Passou da meta de SLA_META_DIAS na etapa atual. Pausada não atrasa.
 *
 * ⚠️ Critério ÚNICO: o menu, o Quadro, o Início e os Indicadores contavam cada
 * um do seu jeito (dias na etapa × dias em aberto) e mostravam 7 numa tela e 9
 * na outra para as mesmas vagas.
 */
export function vagaAtrasada(vaga: Vaga): boolean {
  return !encerrada(vaga.status) && !isPausedOrSuspended(vaga.status) && diasNestaEtapa(vaga) > SLA_META_DIAS;
}

/**
 * Os códigos das próximas `quantidade` vagas, em sequência.
 *
 * ⚠️ Existe porque abrir um lote chamando o "abre uma vaga" N vezes num laço
 * gera N vagas com o MESMO código: o próximo código sai de `Math.max` sobre a
 * lista carregada, e essa lista só muda quando o Firestore devolve o snapshot —
 * bem depois das N chamadas terem lido o mesmo máximo. Numerar o lote inteiro
 * de uma vez, aqui, é o que impede isso.
 *
 * A base 1000 (primeiro código = 1001) é a do banco desde a importação inicial.
 */
export function codigosSequenciais(existentes: { codigo: number }[], quantidade: number): number[] {
  const quantas = Math.max(0, Math.floor(quantidade) || 0);
  const maior = existentes.length > 0 ? Math.max(...existentes.map(v => v.codigo || 0)) : 1000;
  return Array.from({ length: quantas }, (_, i) => maior + 1 + i);
}

const EM_ANDAMENTO_OU_PARADA = ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO', 'PAUSADA', 'SUSPENSA'];
const partesDoNome = (s?: string) => normalizarNome((s || '').replace(/[^\p{L}\p{N} ]/gu, ' '))
  .split(' ').filter(p => p && !['de', 'da', 'do', 'dos', 'das', 'e'].includes(p));
/** "Gilberto Maciel" é "Gilberto Maciel de Oliveira"; "Maria Eduarda Silva" não é "Maria Eduarda Costa". */
function mesmaPessoa(a?: string, b?: string): boolean {
  const [x, y] = [partesDoNome(a), partesDoNome(b)].sort((p, q) => p.length - q.length);
  if (!x.length) return false;
  if (x.length === 1) return y.length === 1 && x[0] === y[0];
  return x.every((p, i) => p === y[i]);
}

/**
 * Vagas não fechadas que parecem a que está sendo aberta. Em 27/10/2026 o RH
 * da Universidade tinha ~9 vagas lançadas duas vezes (a da planilha e uma
 * criada de novo na tela): fechava uma, a outra seguia aberta e parecia que
 * "a vaga voltou". Avisa, não trava — duas posições iguais podem ser reais.
 *  - com substituído: o mesmo substituído (um nome é o começo do outro) — o cargo vem com
 *    grafias diferentes ("Agente Acadêmico de Coordenação" × "Agente de
 *    Coordenação Acadêmico"), a pessoa substituída não;
 *  - sem substituído: mesmo cargo, sede e solicitante.
 */
export function vagasParecidas(
  nova: Pick<Vaga, 'vaga' | 'sede' | 'solicitante' | 'funcionarioSubstituido'>,
  vagas: Vaga[],
): Vaga[] {
  const abertas = vagas.filter(v => EM_ANDAMENTO_OU_PARADA.includes(v.status));
  if (partesDoNome(nova.funcionarioSubstituido).length) return abertas.filter(v => mesmaPessoa(v.funcionarioSubstituido, nova.funcionarioSubstituido));
  const cargo = normalizarNome(nova.vaga), sede = normalizarNome(nova.sede);
  if (!cargo || !partesDoNome(nova.solicitante).length) return [];
  return abertas.filter(v => normalizarNome(v.vaga) === cargo && normalizarNome(v.sede) === sede && mesmaPessoa(v.solicitante, nova.solicitante));
}
