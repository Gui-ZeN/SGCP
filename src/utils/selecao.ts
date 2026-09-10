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

/** Campos gravados ao confirmar: ausentes saem da conta, não da digitação. */
export function camposDaConfirmacao(convocados: number, compareceram: number): Pick<Selecao, 'status' | 'compareceram' | 'ausentes'> {
  return {
    status: 'realizado',
    compareceram,
    ausentes: Math.max(0, convocados - compareceram),
  };
}
