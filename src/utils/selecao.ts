/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regras do ciclo de vida de um dia de seleção: agendar antes, confirmar depois.
 */

import type { Selecao } from '../types';

/**
 * O evento já aconteceu?
 *
 * Registro SEM status conta como realizado — são os 220 importados da planilha,
 * que já tinham acontecido. Tratar ausência como "agendado" apagaria o
 * histórico inteiro do funil.
 */
export function ehRealizada(s: Pick<Selecao, 'status'>): boolean {
  return (s.status || 'realizado') === 'realizado';
}

/** Agendamento cuja data já passou e ninguém confirmou — vira cobrança na agenda. */
export function estaAtrasada(s: Pick<Selecao, 'status' | 'data'>, hojeBR: string): boolean {
  if (ehRealizada(s)) return false;
  const chave = (br: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((br || '').trim());
    return m ? Number(m[3] + m[2] + m[1]) : null;
  };
  const dia = chave(s.data);
  const hoje = chave(hojeBR);
  return dia !== null && hoje !== null && dia < hoje;
}

/** Erros do agendamento, em pt-BR. Lista vazia = pode gravar. */
export function validarAgendamento(dados: {
  data?: string; cargo?: string; sede?: string; convocados?: number;
}): string[] {
  const erros: string[] = [];
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test((dados.data || '').trim())) erros.push('Escolha a data da seleção.');
  if (!(dados.cargo || '').trim()) erros.push('Informe o cargo.');
  if (!(dados.sede || '').trim()) erros.push('Informe a sede.');
  if (!dados.convocados || dados.convocados < 1) erros.push('Informe quantas pessoas foram convocadas.');
  return erros;
}

/**
 * Erros da confirmação de presença.
 *
 * Compareceram acima de convocados é erro de digitação, não dado: apareceria
 * como taxa acima de 100% no indicador.
 */
export function validarConfirmacao(convocados: number, compareceram: number): string[] {
  const erros: string[] = [];
  if (compareceram < 0) erros.push('O número de presentes não pode ser negativo.');
  if (compareceram > convocados) {
    erros.push(`Compareceram (${compareceram}) não pode ser maior que convocados (${convocados}).`);
  }
  return erros;
}

/**
 * Códigos das vagas ligadas à seleção, em um formato só.
 *
 * Lê a LISTA (formato atual) e cai no campo único dos registros gravados antes
 * dela. Sem isto, toda tela que mostra o vínculo precisaria conhecer os dois
 * formatos — e os agendamentos de setembro apareceriam sem vaga nenhuma.
 */
export function codigosDasVagas(s: Pick<Selecao, 'vagaCodigos' | 'vagaCodigo'>): number[] {
  if (s.vagaCodigos?.length) return s.vagaCodigos;
  return s.vagaCodigo === undefined || s.vagaCodigo === null ? [] : [s.vagaCodigo];
}

export interface FunilDaVaga {
  /** Seleções realizadas ligadas a esta vaga. */
  selecoes: number;
  chamados: number;
  compareceram: number;
  aprovados: number;
  /** Data da última seleção realizada, DD/MM/AAAA. */
  ultimaData: string;
}

/**
 * Soma o que as seleções desta vaga já registraram.
 *
 * Serve para PRÉ-PREENCHER o funil quando o RH move a vaga de etapa: os
 * números de chamou/veio/aprovou já foram digitados uma vez na seleção, e
 * pedi-los de novo é o tipo de digitação dupla que o sistema existe para
 * evitar. Nada aqui grava sozinho — quem decide é quem move a vaga.
 *
 * Só conta seleção REALIZADA: um agendamento futuro tem `compareceram: 0` e
 * entraria como "ninguém veio".
 */
export function funilDaVaga(
  selecoes: Selecao[],
  vaga: { id: string; codigo?: number | string }
): FunilDaVaga {
  const codigo = vaga.codigo === undefined || vaga.codigo === null ? null : Number(vaga.codigo);
  const ligadas = selecoes.filter(s => {
    if (!ehRealizada(s)) return false;
    if (s.vagaIds?.includes(vaga.id) || s.vagaId === vaga.id) return true;
    return codigo !== null && codigosDasVagas(s).includes(codigo);
  });

  return {
    selecoes: ligadas.length,
    chamados: ligadas.reduce((t, s) => t + (s.convocados || 0), 0),
    compareceram: ligadas.reduce((t, s) => t + (s.compareceram || 0), 0),
    aprovados: ligadas.reduce((t, s) => t + (s.contratados || 0), 0),
    ultimaData: ligadas
      .map(s => s.data)
      .sort((a, b) => (a || '').split('/').reverse().join('').localeCompare((b || '').split('/').reverse().join('')))
      .at(-1) || '',
  };
}

export interface TotaisDeSelecao {
  convocados: number;
  compareceram: number;
  ausentes: number;
  desistiram: number;
  contratados: number;
  /** Quantos dias ainda esperam confirmação de presença. */
  aConfirmar: number;
  /** % de comparecimento, ou null quando não há dia realizado para medir. */
  taxa: number | null;
}

/**
 * Soma os dias de seleção — a linha "TOTAL" que as abas QUANTI trazem no topo.
 *
 * Agendado NÃO entra no numerador nem no denominador da taxa: um dia que ainda
 * não chegou tem `compareceram: 0`, e somá-lo derrubaria o comparecimento por
 * um evento que nem aconteceu. Ele aparece só em `aConfirmar`.
 */
export function totaisDeSelecoes(selecoes: Selecao[]): TotaisDeSelecao {
  const realizadas = selecoes.filter(ehRealizada);
  const soma = (campo: keyof Pick<Selecao, 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados'>) =>
    realizadas.reduce((t, s) => t + (s[campo] || 0), 0);

  const convocados = soma('convocados');
  const compareceram = soma('compareceram');

  return {
    convocados,
    compareceram,
    ausentes: soma('ausentes'),
    desistiram: soma('desistiram'),
    contratados: soma('contratados'),
    aConfirmar: selecoes.length - realizadas.length,
    taxa: convocados === 0 ? null : Math.round((compareceram / convocados) * 1000) / 10,
  };
}

/** Campos gravados ao confirmar: ausentes saem da conta, não da digitação. */
export function camposDaConfirmacao(convocados: number, compareceram: number): Pick<Selecao, 'status' | 'compareceram' | 'ausentes'> {
  return {
    status: 'realizado',
    compareceram,
    ausentes: Math.max(0, convocados - compareceram),
  };
}
