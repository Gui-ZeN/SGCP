/**
 * O que a aba Início mostra como "para hoje" (repaginada em 24/09/2026: de
 * vitrine de números para lista do que pede ação). Puro, para ser testado.
 */
import type { Vaga, Experiencia, Selecao, Requisicao, Consulta } from '../types';
import { getDiasEmAberto } from './vaga';
import { SLA_META_DIAS } from '../constants/hr';
import { ehRealizada, estaAtrasada } from './selecao';
import { diasEntre } from './date';
import { avaliacoesAVencer, LIMITE_ATRASO_DIAS } from '../components/indicadores/AbaPessoas';

/** Avaliação de experiência entra na lista quando vence em até 7 dias (ou já venceu, até o limite). */
export const JANELA_AVALIACAO_DIAS = 7;

export interface PendenciasDoDia {
  selecoesSemConfirmar: Selecao[];
  selecoesHoje: Selecao[];
  avaliacoes: { e: Experiencia; marco: '45 dias' | '90 dias'; dias: number }[];
  requisicoes: { r: Requisicao; dias: number }[];
  vagasForaDoPrazo: { v: Vaga; dias: number }[];
  consultas: Consulta[];
}

export function pendenciasDoDia(entrada: {
  hojeISO: string;
  hojeBR: string;
  vagas: Vaga[];
  experiencias: Experiencia[];
  selecoes?: Selecao[];
  requisicoes?: Requisicao[];
  consultas?: Consulta[];
}): PendenciasDoDia {
  const { hojeISO, hojeBR, vagas, experiencias, selecoes = [], requisicoes = [], consultas = [] } = entrada;
  return {
    selecoesSemConfirmar: selecoes.filter(s => estaAtrasada(s, hojeBR)).sort((a, b) => ordemBR(a.data) - ordemBR(b.data)),
    selecoesHoje: selecoes.filter(s => !ehRealizada(s) && s.data === hojeBR),
    // Vencida há mais de 30 dias é pendência antiga sem desfecho, não tarefa de hoje.
    avaliacoes: avaliacoesAVencer(experiencias, JANELA_AVALIACAO_DIAS, hojeISO).filter(x => x.dias >= -LIMITE_ATRASO_DIAS),
    requisicoes: requisicoes
      .filter(r => r.status === 'pendente')
      .map(r => ({ r, dias: diasEntre((r.criadaEm || '').slice(0, 10), hojeISO) ?? 0 }))
      .sort((a, b) => b.dias - a.dias),
    // Pausadas/suspensas ficam de fora: o relógio delas está congelado.
    vagasForaDoPrazo: vagas
      .filter(v => ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'].includes((v.status || '').toUpperCase()))
      .map(v => ({ v, dias: getDiasEmAberto(v) }))
      .filter(x => x.dias > SLA_META_DIAS)
      .sort((a, b) => b.dias - a.dias),
    consultas: consultas.filter(c => c.status === 'No aguardo').sort((a, b) => ordemBR(a.dataSolicitacao) - ordemBR(b.dataSolicitacao)),
  };
}

function ordemBR(br: string): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((br || '').trim());
  return m ? Number(m[3] + m[2] + m[1]) : 0;
}

/** "vence hoje", "vence em 3 dias", "venceu há 2 dias". */
export function quandoVence(dias: number): string {
  if (dias === 0) return 'vence hoje';
  if (dias > 0) return dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;
  return -dias === 1 ? 'venceu ontem' : `venceu há ${-dias} dias`;
}
