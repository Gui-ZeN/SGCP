/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Helpers de data centralizados — extraídos da implementação robusta que já
 * existia em lib/spreadsheetImport.ts e que estava reimplementada (pior e com
 * divergências) em ~7 componentes. Lida com Date nativo, serial do Excel,
 * ISO (YYYY-MM-DD) e BR (DD/MM/YYYY), rejeitando datas inválidas (ex.: 45/13).
 */

import { MONTHS_ABBR, MONTHS_FULL } from '../constants/hr';

export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return Number.isNaN(dateInfo.getTime())
    ? null
    : new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
}

// Rejeita overflow silencioso do construtor Date (ex.: dia 45, mês 13 viram outra data).
function validDate(year: number, monthIndex: number, day: number): Date | null {
  const d = new Date(year, monthIndex, day);
  if (d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) return null;
  return d;
}

export function dateFromValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') return excelSerialToDate(value);

  const text = cleanText(value);
  if (!text || text === '-') return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return validDate(Number(br[3]), Number(br[2]) - 1, Number(br[1]));

  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** DD/MM/YYYY. Se não conseguir interpretar, devolve o texto limpo original. */
export function formatDateBR(value: unknown): string {
  const date = dateFromValue(value);
  if (!date) return cleanText(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** YYYY-MM-DD para usar em <input type="date">. '' se inválida. */
export function toISOInput(value: unknown): string {
  const date = dateFromValue(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function monthAbbrFromDate(value: unknown): string {
  const date = dateFromValue(value);
  return date ? MONTHS_ABBR[date.getMonth()] : '';
}

export function monthFullFromDate(value: unknown): string {
  const date = dateFromValue(value);
  return date ? MONTHS_FULL[date.getMonth()] : '';
}

export function yearFromDate(value: unknown): number {
  const date = dateFromValue(value);
  return date ? date.getFullYear() : new Date().getFullYear();
}
