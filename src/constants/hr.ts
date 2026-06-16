/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Constantes compartilhadas de RH. Centraliza listas que antes estavam
 * duplicadas (com divergências) em vários componentes/utilitários.
 */

export const MONTHS_FULL = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

export const MONTHS_ABBR = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.'
];

// Meta de SLA do RH: uma vaga deve fechar em até 15 dias (definido na reunião de
// mapeamento de RH). Passar disso dispara o alerta de SLA. Centralizado aqui para
// não espalhar o número mágico pelos componentes.
export const SLA_META_DIAS = 15;

// Motivos padronizados de desistência de candidato (lista suspensa em vez de texto
// livre, para indicadores confiáveis — definido na reunião de mapeamento de RH).
export const MOTIVOS_DESISTENCIA = [
  'Salário abaixo do esperado',
  'Benefícios',
  'Encontrou outro emprego',
  'Distância / transporte',
  'Incompatibilidade de horário',
  'Não compareceu',
  'Outros'
];
