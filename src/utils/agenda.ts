/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Agenda diária do RH (beta) — o dia de trabalho visto de perto.
 *
 * Nasceu de um pedido do Diretor: o RH trabalha muito e não aparece, porque só
 * existe o resumo do mês. Aqui o dia é o recorte.
 *
 * DERIVA do que já está registrado; não pede lançamento novo. Todo evento aqui
 * é uma data que o RH já preenche em outro módulo (seleção, vaga, integração,
 * entrevista, consulta, prazo de experiência). Um "diário" com formulário
 * próprio seria mais uma tarefa para quem já não tem tempo — e a primeira a ser
 * abandonada.
 */

import type { Selecao, Vaga, Integracao, Entrevista, Consulta, Experiencia } from '../types';
import { ehRealizada, codigosDasVagas } from './selecao';

export type TipoEvento =
  | 'selecao'
  | 'selecao-agendada'
  | 'vaga-aberta'
  | 'vaga-concluida'
  | 'integracao'
  | 'entrevista'
  | 'consulta-aberta'
  | 'consulta-atendida'
  | 'experiencia-45'
  | 'experiencia-90';

export interface EventoAgenda {
  tipo: TipoEvento;
  /** O que aconteceu, em uma linha. */
  titulo: string;
  /** Quem/onde — sede, setor, responsável. */
  contexto?: string;
  /** Números do evento, quando houver (convocados × presentes). */
  numeros?: string;
  /** Preenchidos só em seleção — a agenda confirma a presença ali mesmo. */
  selecaoId?: string;
  convocados?: number;
}

export interface ResumoDoDia {
  convocados: number;
  compareceram: number;
  vagasAbertas: number;
  vagasConcluidas: number;
  integracoes: number;
  entrevistas: number;
  /** Prazos de experiência (45 e 90 dias) que vencem no dia. */
  prazos: number;
  /** Seleções agendadas do dia ainda sem confirmação de presença. */
  aConfirmar: number;
}

export interface AgendaDoDia {
  resumo: ResumoDoDia;
  eventos: EventoAgenda[];
}

export interface FontesAgenda {
  selecoes: Selecao[];
  vagas: Vaga[];
  integracoes: Integracao[];
  entrevistas: Entrevista[];
  consultas: Consulta[];
  experiencias: Experiencia[];
}

/** Compara datas DD/MM/AAAA como texto — sem fuso, sem Date, sem surpresa. */
const ehODia = (data: string | undefined, dia: string) =>
  !!data && data.trim() === dia;

/** "1 vaga aberta" / "3 vagas abertas" — sem "(s)" na cara do usuário. */
const plural = (n: number, singular: string, pluralForma: string) =>
  `${n} ${n === 1 ? singular : pluralForma}`;

/**
 * Monta a agenda de UM dia (`dia` em DD/MM/AAAA).
 *
 * A ordem dos eventos é a ordem de leitura do dia do RH: primeiro o que reúne
 * gente (seleção, integração, entrevista), depois o fluxo de vagas, e por fim
 * os prazos — que são lembrete, não atividade.
 */
export function montarAgendaDoDia(dia: string, fontes: FontesAgenda): AgendaDoDia {
  const eventos: EventoAgenda[] = [];
  const resumo: ResumoDoDia = {
    convocados: 0, compareceram: 0, vagasAbertas: 0,
    vagasConcluidas: 0, integracoes: 0, entrevistas: 0, prazos: 0, aConfirmar: 0,
  };

  fontes.selecoes.filter(s => ehODia(s.data, dia)).forEach(s => {
    const realizada = ehRealizada(s);
    resumo.convocados += s.convocados || 0;
    // Presença só entra depois de confirmada — agendado tem 0 porque ainda não
    // aconteceu, e somar isso faria o card do dia mentir.
    if (realizada) resumo.compareceram += s.compareceram || 0;
    else resumo.aConfirmar++;

    eventos.push({
      tipo: realizada ? 'selecao' : 'selecao-agendada',
      titulo: (() => {
        const codigos = codigosDasVagas(s);
        if (!codigos.length) return `Seleção — ${s.cargo}`;
        const rotulo = codigos.length === 1 ? 'vaga' : 'vagas';
        return `Seleção — ${s.cargo} (${rotulo} ${codigos.map(c => `#${c}`).join(' ')})`;
      })(),
      contexto: [s.sede, s.responsavel].filter(Boolean).join(' · '),
      numeros: realizada
        ? `${s.convocados || 0} convocados · ${s.compareceram || 0} compareceram`
        : `${s.convocados || 0} convocados · a confirmar`,
      selecaoId: s.id,
      convocados: s.convocados || 0,
    });
  });

  fontes.integracoes.filter(i => ehODia(i.dataIntegracao, dia)).forEach(i => {
    resumo.integracoes++;
    eventos.push({
      tipo: 'integracao',
      titulo: `Integração — ${i.nome}`,
      contexto: [i.sede, i.setor].filter(Boolean).join(' · '),
    });
  });

  fontes.entrevistas.filter(e => ehODia(e.dataEntrevista, dia)).forEach(e => {
    resumo.entrevistas++;
    eventos.push({
      tipo: 'entrevista',
      titulo: `Entrevista de desligamento — ${e.anonima ? 'anônima' : e.colaborador}`,
      contexto: [e.unidade, e.funcao].filter(Boolean).join(' · '),
    });
  });

  fontes.vagas.filter(v => ehODia(v.solicitacao, dia)).forEach(v => {
    resumo.vagasAbertas++;
    eventos.push({
      tipo: 'vaga-aberta',
      titulo: `Vaga solicitada — ${v.vaga}`,
      contexto: [v.sede, v.setor, v.solicitante].filter(Boolean).join(' · '),
    });
  });

  fontes.vagas.filter(v => ehODia(v.conclusao, dia)).forEach(v => {
    resumo.vagasConcluidas++;
    eventos.push({
      tipo: 'vaga-concluida',
      titulo: `Vaga concluída — ${v.vaga}`,
      contexto: [v.sede, v.setor].filter(Boolean).join(' · '),
      numeros: v.tempoProcesso ? `${v.tempoProcesso} dias de processo` : undefined,
    });
  });

  fontes.consultas.filter(c => ehODia(c.dataSolicitacao, dia)).forEach(c => {
    eventos.push({
      tipo: 'consulta-aberta',
      titulo: `Consulta solicitada — ${c.especialidade}`,
      contexto: c.funcionario,
    });
  });

  fontes.consultas
    .filter(c => c.status === 'Atendido' && ehODia(c.dataAtendimento, dia))
    .forEach(c => {
      eventos.push({
        tipo: 'consulta-atendida',
        titulo: `Consulta atendida — ${c.especialidade}`,
        contexto: c.funcionario,
      });
    });

  // Prazos de experiência: lembrete do dia, não atividade realizada. Só os que
  // ainda estão em andamento — cobrar prazo de quem já foi efetivado ou
  // encerrado é ruído.
  const emAndamento = fontes.experiencias.filter(
    e => e.status === 'EM_ANALISE' || e.status === 'PRORROGADO'
  );

  emAndamento.filter(e => ehODia(e.termino1, dia)).forEach(e => {
    resumo.prazos++;
    eventos.push({
      tipo: 'experiencia-45',
      titulo: `Vence 45 dias — ${e.colaborador}`,
      contexto: [e.sede, e.funcao, e.supervisor].filter(Boolean).join(' · '),
    });
  });

  emAndamento.filter(e => ehODia(e.termino2, dia)).forEach(e => {
    resumo.prazos++;
    eventos.push({
      tipo: 'experiencia-90',
      titulo: `Vence 90 dias — ${e.colaborador}`,
      contexto: [e.sede, e.funcao, e.supervisor].filter(Boolean).join(' · '),
    });
  });

  return { resumo, eventos };
}

/**
 * O que o dia teve FORA de seleção, em uma linha.
 *
 * A tela de Seleções é a folha do dia, no formato das abas QUANTI. O resto do
 * RH (integração, desligamento, vaga, prazo de experiência) não some por isso:
 * vira esta linha no topo. Sem ela, o dia do RH voltaria a ser só seleção —
 * exatamente a cegueira que a Diretoria reclamou.
 */
export function resumoDeOutrosModulos(resumo: ResumoDoDia): string {
  const partes: string[] = [];
  if (resumo.vagasAbertas) partes.push(plural(resumo.vagasAbertas, 'vaga aberta', 'vagas abertas'));
  if (resumo.vagasConcluidas) partes.push(plural(resumo.vagasConcluidas, 'vaga concluída', 'vagas concluídas'));
  if (resumo.integracoes) partes.push(plural(resumo.integracoes, 'integração', 'integrações'));
  if (resumo.entrevistas) partes.push(plural(resumo.entrevistas, 'entrevista de saída', 'entrevistas de saída'));
  if (resumo.prazos) partes.push(plural(resumo.prazos, 'prazo de experiência', 'prazos de experiência'));
  return partes.join(' · ');
}

/** Uma frase com o que o dia rendeu — o "apareceu" que o Diretor pediu. */
export function resumoEmTexto(resumo: ResumoDoDia): string {
  const partes: string[] = [];
  if (resumo.convocados) partes.push(plural(resumo.convocados, 'convocado', 'convocados'));
  if (resumo.compareceram) partes.push(`${resumo.compareceram} compareceram`);
  if (resumo.vagasAbertas) partes.push(plural(resumo.vagasAbertas, 'vaga aberta', 'vagas abertas'));
  if (resumo.vagasConcluidas) partes.push(plural(resumo.vagasConcluidas, 'vaga concluída', 'vagas concluídas'));
  if (resumo.integracoes) partes.push(plural(resumo.integracoes, 'integração', 'integrações'));
  if (resumo.entrevistas) partes.push(plural(resumo.entrevistas, 'entrevista de saída', 'entrevistas de saída'));
  if (resumo.prazos) partes.push(plural(resumo.prazos, 'prazo de experiência', 'prazos de experiência'));
  if (resumo.aConfirmar) partes.push(plural(resumo.aConfirmar, 'seleção a confirmar', 'seleções a confirmar'));
  return partes.length ? partes.join(' · ') : 'Nenhum registro neste dia.';
}
