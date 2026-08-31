/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regras puras do módulo de Consultas (sem UI, sem Firebase). O que existe de
 * lógica no módulo é a coerência entre STATUS e DATA DE ATENDIMENTO — os dois
 * campos contam a mesma história e não podem se contradizer.
 */

import type { Consulta } from '../types';
import { dataISOLocal, dateFromValue, diasEntre } from './date';

export const STATUS_CONSULTA = ['No aguardo', 'Atendido'] as const;
export type StatusConsulta = (typeof STATUS_CONSULTA)[number];

/** Corpo da consulta sem o id do documento — o que o formulário monta. */
export type ConsultaInput = Omit<Consulta, 'id'>;

/**
 * Status e data de atendimento andam juntos: voltar para "No aguardo" LIMPA a
 * data. Sem isso, uma consulta reaberta continuaria carregando a data de um
 * atendimento que não vale mais — e ela reapareceria ao marcar Atendido de novo.
 */
export function coerirAtendimento<T extends Pick<Consulta, 'status' | 'dataAtendimento'>>(consulta: T): T {
  if (consulta.status === 'Atendido') return consulta;
  return { ...consulta, dataAtendimento: '' };
}

/**
 * Erros de preenchimento, em pt-BR e prontos para exibir. Lista vazia = pode
 * gravar. Validar aqui (e não só no `required` do input) mantém a regra testável
 * e vale igual para o formulário de criação e o de edição.
 */
export function validarConsulta(consulta: Partial<ConsultaInput>): string[] {
  const erros: string[] = [];

  if (!(consulta.funcionario || '').trim()) erros.push('Informe o funcionário.');
  if (!(consulta.especialidade || '').trim()) erros.push('Informe a especialidade solicitada.');
  if (!dateFromValue(consulta.dataSolicitacao)) erros.push('Informe uma data de solicitação válida.');

  if (!STATUS_CONSULTA.includes(consulta.status as StatusConsulta)) {
    erros.push('Selecione um status válido.');
  } else if (consulta.status === 'Atendido') {
    if (!dateFromValue(consulta.dataAtendimento)) {
      erros.push('Consulta atendida exige a data do atendimento.');
    } else {
      const dias = diasEntre(consulta.dataSolicitacao || '', consulta.dataAtendimento || '');
      if (dias !== null && dias < 0) {
        erros.push('A data do atendimento não pode ser anterior à da solicitação.');
      }
    }
  }

  return erros;
}

/**
 * Dias de espera da consulta: da solicitação até o atendimento, ou até HOJE
 * enquanto está na fila.
 *
 * Existe para a exportação — é o número que interessa ao RH ("quanto tempo essa
 * pessoa está esperando?") e que a tabela não mostra. Devolve `null` quando não
 * há como calcular, para a célula sair vazia em vez de zero: zero dia de espera
 * é uma informação, célula vazia é a ausência dela.
 */
export function diasDeEspera(
  consulta: Pick<Consulta, 'status' | 'dataSolicitacao' | 'dataAtendimento'>,
  hoje: Date = new Date()
): number | null {
  const fim = consulta.status === 'Atendido' ? consulta.dataAtendimento : dataISOLocal(hoje);
  if (!fim) return null;
  const dias = diasEntre(consulta.dataSolicitacao, fim);
  return dias === null || dias < 0 ? null : dias;
}
