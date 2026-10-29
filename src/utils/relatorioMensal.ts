/**
 * Números do relatório mensal de indicadores do RH (29/10/2026), no modelo do
 * deck que a Universidade monta à mão no Canva ("Indicadores de Setembro"):
 * vagas do mês, funil das seleções por grupo e por cargo, desistências,
 * experiência e integração por sede, treinamentos. Funções puras; a folha sai
 * em utils/relatorioMensalHtml.ts.
 *
 * Conferido com setembro/2026 da Universidade: solicitadas (25), desistentes
 * (17) e o treinamento da Recepção (24 de 30) batem com o deck; o que não bate
 * é lançamento que falta no sistema, e volta em `avisos`.
 */
import type { Vaga, Selecao, Experiencia, Integracao, Treinamento } from '../types';
import { anoMes } from './filtroIndicadores';
import { motivosDesistencia, integracaoPorSede, totalGeral, type CumprimentoSede } from './indicadores';
import { ehRealizada } from './selecao';
import { MOTIVOS_DESISTENCIA } from './candidatos';
import { normalizeKey } from '../lib/spreadsheetImport';

export type Grupo = 'Infraestrutura' | 'Atendimento' | 'Pedagógico' | 'Administrativo' | 'Seleções Gerais';
export const GRUPOS: Grupo[] = ['Infraestrutura', 'Atendimento', 'Pedagógico', 'Administrativo', 'Seleções Gerais'];

/**
 * Tabela fixa tirada das listas de cargos do deck de setembro (decisão do
 * Guilherme, 29/10/2026). Cargo fora dela: Pedagógico se a seleção é da aba
 * pedagógica (professores do Colégio), senão Seleções Gerais — é o "resto" no
 * deck (I.A.C, Analista de MKT, ASB, TSB).
 */
const CARGOS_DO_GRUPO: [Grupo, string[]][] = [
  ['Infraestrutura', ['asg', 'auxiliar de servicos gerais', 'chefe de manutencao', 'tme', 'encarregado de limpeza']],
  ['Atendimento', ['auxiliar de cantina', 'atendente recepcionista', 'recepcionista']],
  ['Pedagógico', ['assistente de secretaria', 'assistente de laboratorio', 'auxiliar de laboratorio', 'agente academico', 'apoio de coordenacao']],
  ['Administrativo', ['auxiliar de departamento pessoal', 'auxiliar de dp', 'assistente de tesouraria', 'assistente de rh',
    'assistente administrativo', 'assistente adm', 'apoio administrativo']],
];

// Os motivos são gravados pela chave normalizada ("nao compareceu para os testes"): volta a grafia da lista.
const GRAFIA_DO_MOTIVO = new Map(MOTIVOS_DESISTENCIA.map(m => [normalizeKey(m), m]));
const grafiaDoMotivo = (k: string) => GRAFIA_DO_MOTIVO.get(k) || k.charAt(0).toUpperCase() + k.slice(1);

const norm = (s?: string) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function grupoDoCargo(cargo: string, origem?: string): Grupo {
  const n = norm(cargo);
  for (const [grupo, prefixos] of CARGOS_DO_GRUPO) if (prefixos.some(p => n === p || n.startsWith(p + ' '))) return grupo;
  return origem === 'pedagogico' ? 'Pedagógico' : 'Seleções Gerais';
}

export interface Funil { convocados: number; presentes: number; ausentes: number; desistentes: number }
export interface FunilDoCargo extends Funil { cargo: string; grupo: Grupo }

export interface ExperienciaDaSede {
  sede: string;
  /** Avaliações (45 ou 90 dias) que venceram no mês. */
  programadas: number;
  /** Com desfecho lançado. */
  realizadas: number;
  prorrogadas: number;
  efetivadas: number;
  desligados: number;
  pediram: number;
  /** Venceu e continua sem desfecho no sistema. */
  semDesfecho: number;
  /** Do mês, mas ainda não chegou o dia (relatório do mês corrente): fora da participação. */
  aVencer: number;
}

/** `ids`: as turmas somadas — de onde vêm as fotos anexadas para o destaque. */
export interface TreinamentoDoMes { tema: string; previstos: number; presentes: number; turmas: number; sedes: string[]; ids: string[] }

export interface DadosDoRelatorio {
  vagas: { solicitadas: number; fechadas: number; mediaDias: number | null };
  selecao: { total: Funil; grupos: { grupo: Grupo; total: Funil; cargos: string[] }[]; cargos: FunilDoCargo[]; motivos: { name: string; total: number }[] };
  experiencia: ExperienciaDaSede[];
  /** null = unidade sem integração no mês. */
  integracao: { geral: CumprimentoSede; sedes: CumprimentoSede[] } | null;
  treinamentos: TreinamentoDoMes[];
  /** O que falta lançar para o relatório bater — vai para a tela, não para o PDF. */
  avisos: string[];
}

/** DD/MM/AAAA ou AAAA-MM-DD → AAAA-MM-DD, para comparar com hoje. */
const isoDe = (d?: string) => {
  const s = (d || '').trim(), br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  return br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : s.slice(0, 10);
};
const doMes = (ano: number, mes: number) => (d?: string) => { const am = anoMes(d); return !!am && am[0] === ano && am[1] === mes; };
const vazio = (): Funil => ({ convocados: 0, presentes: 0, ausentes: 0, desistentes: 0 });
const somar = (f: Funil, s: Selecao) => {
  f.convocados += Number(s.convocados) || 0; f.presentes += Number(s.compareceram) || 0;
  f.ausentes += Number(s.ausentes) || 0; f.desistentes += Number(s.desistiram) || 0;
};

/**
 * Experiência pelas avaliações que VENCERAM no mês (1º ou 2º período), com o
 * desfecho lido do status atual: no 1º período, quem seguiu (prorrogado ou já
 * efetivado) conta como prorrogação; no 2º, efetivado é efetivação. Encerrado
 * separa quem pediu para sair de quem foi desligado. Sem desfecho e com o dia
 * ainda por vir (mês corrente) é "a vencer", não pendência.
 */
export function experienciaDoMes(lista: Experiencia[], ano: number, mes: number, hojeISO: string): ExperienciaDaSede[] {
  const noMes = doMes(ano, mes);
  const porSede = new Map<string, ExperienciaDaSede>();
  for (const e of lista) {
    const primeiro = noMes(e.termino1), segundo = noMes(e.termino2);
    if (!primeiro && !segundo) continue;
    const sede = (e.sede || '').trim() || '—';
    const l = porSede.get(sede) || { sede, programadas: 0, realizadas: 0, prorrogadas: 0, efetivadas: 0, desligados: 0, pediram: 0, semDesfecho: 0, aVencer: 0 };
    l.programadas++;
    if (e.status === 'ENCERRADO') { l.realizadas++; if (e.tipoEncerramento === 'a_pedido') l.pediram++; else l.desligados++; }
    else if (primeiro && e.status !== 'EM_ANALISE') { l.realizadas++; l.prorrogadas++; }
    else if (segundo && e.status === 'EFETIVADO') { l.realizadas++; l.efetivadas++; }
    else if (isoDe(primeiro ? e.termino1 : e.termino2) >= hojeISO) l.aVencer++;
    else l.semDesfecho++;
    porSede.set(sede, l);
  }
  return [...porSede.values()].sort((a, b) => b.programadas - a.programadas || a.sede.localeCompare(b.sede, 'pt-BR'));
}

/** Treinamentos do mês somados por tema: o mesmo tema em várias sessões é uma ação só no deck (Recepção: 15 + 15). */
export function treinamentosDoMes(lista: Treinamento[], ano: number, mes: number): TreinamentoDoMes[] {
  const noMes = doMes(ano, mes);
  const porTema = new Map<string, TreinamentoDoMes>();
  for (const t of lista) {
    if (!noMes(t.dataInicio)) continue;
    const k = norm(t.tema);
    const l = porTema.get(k) || { tema: (t.tema || '').trim(), previstos: 0, presentes: 0, turmas: 0, sedes: [], ids: [] };
    l.previstos += Number(t.qtdPrevista) || 0; l.presentes += Number(t.qtdRealizada) || 0; l.turmas++; l.ids.push(t.id);
    for (const s of t.sedes?.length ? t.sedes : [t.unidade]) if (s && !l.sedes.includes(s)) l.sedes.push(s);
    porTema.set(k, l);
  }
  return [...porTema.values()].sort((a, b) => b.previstos - a.previstos);
}

export function dadosDoRelatorio(e: {
  ano: number; mes: number;
  vagas: Vaga[]; selecoes: Selecao[]; experiencias: Experiencia[]; integracoes: Integracao[]; treinamentos: Treinamento[];
  comIntegracao: boolean;
  /** AAAA-MM-DD; o que vence a partir de hoje ainda não é pendência. */
  hojeISO: string;
}): DadosDoRelatorio {
  const noMes = doMes(e.ano, e.mes);
  const avisos: string[] = [];

  // Vagas: cancelada fica fora de todo indicador (27/10/2026).
  const vagas = e.vagas.filter(v => v.status !== 'CANCELADA');
  const fechadas = vagas.filter(v => v.status === 'FECHADA' && noMes(v.conclusao));
  const comTempo = fechadas.filter(v => (v.tempoProcesso || 0) > 0);

  const doMesSel = e.selecoes.filter(s => noMes(s.data));
  const realizadas = doMesSel.filter(ehRealizada);
  const agendadas = doMesSel.length - realizadas.length;
  if (agendadas) avisos.push(`${agendadas} seleção(ões) do mês ainda como agendada(s): ficam fora dos números até confirmar quem compareceu (Resumo do Dia).`);

  const total = vazio();
  const porCargo = new Map<string, FunilDoCargo & { pedagogico: boolean }>();
  for (const s of realizadas) {
    somar(total, s);
    const k = norm(s.cargo);
    const l = porCargo.get(k) || { cargo: (s.cargo || '—').trim(), grupo: 'Seleções Gerais' as Grupo, pedagogico: false, ...vazio() };
    somar(l, s);
    if (s.origem === 'pedagogico') l.pedagogico = true;
    porCargo.set(k, l);
  }
  // Grupo pelo cargo inteiro, não pela 1ª seleção que chegou: o mesmo cargo nas
  // duas abas cai em Pedagógico em qualquer ordem (auditoria, 29/10/2026).
  const cargos: FunilDoCargo[] = [...porCargo.values()]
    .map(({ pedagogico, ...c }) => ({ ...c, grupo: grupoDoCargo(c.cargo, pedagogico ? 'pedagogico' : 'geral') }))
    .sort((a, b) => b.convocados - a.convocados);
  const grupos = GRUPOS.map(grupo => {
    const doGrupo = cargos.filter(c => c.grupo === grupo);
    const t = vazio();
    for (const c of doGrupo) { t.convocados += c.convocados; t.presentes += c.presentes; t.ausentes += c.ausentes; t.desistentes += c.desistentes; }
    return { grupo, total: t, cargos: doGrupo.map(c => c.cargo) };
  }).filter(g => g.total.convocados > 0);
  const motivos = motivosDesistencia(realizadas).map(m => ({ ...m, name: grafiaDoMotivo(m.name) }));
  const comMotivo = motivos.reduce((t, m) => t + m.total, 0);
  if (total.desistentes > comMotivo) avisos.push(`${total.desistentes - comMotivo} de ${total.desistentes} desistente(s) sem motivo lançado: a página de motivos sai incompleta.`);

  const experiencia = experienciaDoMes(e.experiencias, e.ano, e.mes, e.hojeISO);
  const semDesfecho = experiencia.reduce((t, l) => t + l.semDesfecho, 0);
  if (semDesfecho) avisos.push(`${semDesfecho} avaliação(ões) de experiência venceram no mês sem desfecho lançado (aba Experiência).`);

  let integracao: DadosDoRelatorio['integracao'] = null;
  if (e.comIntegracao) {
    const doMesInt = e.integracoes.filter(i => noMes(i.admissao));
    if (doMesInt.length) {
      const sedes = integracaoPorSede(doMesInt);
      integracao = { geral: totalGeral(sedes), sedes };
      const pend = doMesInt.filter(i => i.status === 'Não realizado').length;
      if (pend) avisos.push(`${pend} de ${doMesInt.length} integração(ões) dos admitidos no mês ainda como "Não realizado" (aba Integração).`);
    }
  }

  return {
    vagas: {
      solicitadas: vagas.filter(v => noMes(v.solicitacao)).length,
      fechadas: fechadas.length,
      mediaDias: comTempo.length ? Math.round(comTempo.reduce((t, v) => t + (v.tempoProcesso || 0), 0) / comTempo.length) : null,
    },
    selecao: { total, grupos, cargos, motivos },
    experiencia,
    integracao,
    treinamentos: treinamentosDoMes(e.treinamentos, e.ano, e.mes),
    avisos,
  };
}
