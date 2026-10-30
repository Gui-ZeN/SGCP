/**
 * O que a aba Início mostra como "para hoje" (repaginada em 24/09/2026: de
 * vitrine de números para lista do que pede ação). Puro, para ser testado.
 */
import type { Vaga, Experiencia, Selecao, Requisicao, Consulta, Integracao } from '../types';
import { diasNestaEtapa, vagaAtrasada } from './vaga';
import { ehRealizada, estaAtrasada } from './selecao';
import { diasEntre, toISOInput } from './date';
import { desistentesSemMotivo } from './pendenciasDoMes';
import { feriadosDoMes } from './feriados';
import { avaliacoesAVencer, LIMITE_ATRASO_DIAS } from '../components/indicadores/AbaPessoas';

/** Avaliação de experiência entra na lista quando vence em até 7 dias (ou já venceu, até o limite). */
export const JANELA_AVALIACAO_DIAS = 7;

/**
 * Integração "Não realizado" entra no Início a partir de 7 dias da admissão, e
 * só até 60: mais antiga que isso é estoque (o backfill de julho trouxe 129),
 * que o relatório mensal e a aba Integração mostram (revisão de operação,
 * 30/10/2026: o lembrete é para corrigir no dia, não no fechamento).
 */
export const INTEGRACAO_DIAS = { de: 7, ate: 60 };
/** Desistente sem motivo entra a partir do dia seguinte à seleção, até 30 dias. */
export const MOTIVO_ATE_DIAS = 30;

export interface PendenciasDoDia {
  selecoesSemConfirmar: Selecao[];
  /** Seleções com desistente sem motivo (só as que têm a lista de nomes: é onde o motivo é lançado). */
  desistentesSemMotivo: { s: Selecao; quantos: number }[];
  integracoesPendentes: { i: Integracao; dias: number }[];
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
  integracoes?: Integracao[];
}): PendenciasDoDia {
  const { hojeISO, hojeBR, vagas, experiencias, selecoes = [], requisicoes = [], consultas = [], integracoes = [] } = entrada;
  const desde = (br?: string) => diasEntre(toISOInput(br || ''), hojeISO);
  return {
    selecoesSemConfirmar: selecoes.filter(s => estaAtrasada(s, hojeBR)).sort((a, b) => ordemBR(a.data) - ordemBR(b.data)),
    desistentesSemMotivo: selecoes
      .filter(s => ehRealizada(s) && s.numerosPelaLista && desistentesSemMotivo(s) > 0)
      .filter(s => { const d = desde(s.data); return d !== null && d >= 1 && d <= MOTIVO_ATE_DIAS; })
      .sort((a, b) => ordemBR(a.data) - ordemBR(b.data))
      .map(s => ({ s, quantos: desistentesSemMotivo(s) })),
    integracoesPendentes: integracoes
      .filter(i => i.status === 'Não realizado')
      .map(i => ({ i, dias: desde(i.admissao) ?? -1 }))
      .filter(x => x.dias >= INTEGRACAO_DIAS.de && x.dias <= INTEGRACAO_DIAS.ate)
      .sort((a, b) => b.dias - a.dias),
    selecoesHoje: selecoes.filter(s => !ehRealizada(s) && s.data === hojeBR),
    // Vencida há mais de 30 dias é pendência antiga sem desfecho, não tarefa de hoje.
    avaliacoes: avaliacoesAVencer(experiencias, JANELA_AVALIACAO_DIAS, hojeISO).filter(x => x.dias >= -LIMITE_ATRASO_DIAS),
    requisicoes: requisicoes
      .filter(r => r.status === 'pendente')
      .map(r => ({ r, dias: diasEntre((r.criadaEm || '').slice(0, 10), hojeISO) ?? 0 }))
      .sort((a, b) => b.dias - a.dias),
    // Pausadas/suspensas ficam de fora: o relógio delas está congelado.
    // Dias NA ETAPA, o mesmo critério do badge do menu e do Quadro.
    vagasForaDoPrazo: vagas
      .filter(vagaAtrasada)
      .map(v => ({ v, dias: diasNestaEtapa(v) }))
      .sort((a, b) => b.dias - a.dias),
    consultas: consultas.filter(c => c.status === 'No aguardo').sort((a, b) => ordemBR(a.dataSolicitacao) - ordemBR(b.dataSolicitacao)),
  };
}

function ordemBR(br: string): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((br || '').trim());
  return m ? Number(m[3] + m[2] + m[1]) : 0;
}

/**
 * Lembrete de fechar o relatório do mês anterior: do 1º ao 5º dia útil (sem
 * fim de semana nem feriado), e some quando o relatório daquele mês já foi
 * gerado neste navegador. `gerados`: "unidade|AAAA-MM".
 */
export const CHAVE_RELATORIOS_GERADOS = 'sgpc.relatorioMensal.gerados';
export function relatoriosGerados(): string[] {
  // Só texto: um valor estranho no armazenamento não pode derrubar o Início.
  try { const l = JSON.parse(localStorage.getItem(CHAVE_RELATORIOS_GERADOS) || '[]'); return Array.isArray(l) ? l.filter((g): g is string => typeof g === 'string') : []; } catch { return []; }
}

/** `unidades`: as que quem está logado fecha; o lembrete só some quando TODAS foram geradas (o Administrador fecha as duas). */
export function fechamentoDoMes(hojeISO: string, gerados: string[], unidades: string[] = ['colegio']): { ano: number; mes: number; ate: string } | null {
  const [a, m, d] = hojeISO.split('-').map(Number);
  const feriados = new Set(feriadosDoMes(a, m).map(f => f.dia));
  const uteis: number[] = [];
  for (let dia = 1; uteis.length < 5 && dia <= 31; dia++) {
    const sem = new Date(a, m - 1, dia).getDay();
    if (sem !== 0 && sem !== 6 && !feriados.has(dia)) uteis.push(dia);
  }
  if (d < uteis[0] || d > uteis[uteis.length - 1]) return null;
  const ano = m === 1 ? a - 1 : a, mes = m === 1 ? 12 : m - 1;
  const doMes = `${ano}-${String(mes).padStart(2, '0')}`;
  if (unidades.every(u => gerados.includes(`${u}|${doMes}`))) return null;
  return { ano, mes, ate: `${String(uteis[uteis.length - 1]).padStart(2, '0')}/${String(m).padStart(2, '0')}` };
}

/** "vence hoje", "vence em 3 dias", "venceu há 2 dias". */
export function quandoVence(dias: number): string {
  if (dias === 0) return 'vence hoje';
  if (dias > 0) return dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`;
  return -dias === 1 ? 'venceu ontem' : `venceu há ${-dias} dias`;
}
