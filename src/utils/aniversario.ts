import { Funcionario } from '../types';

/**
 * Helpers puros de aniversário (sem UI) — a base do "avisar o RH".
 * Datas de nascimento em DD/MM/YYYY ou DD/MM (o ano é opcional).
 */

export interface NascimentoParts {
  dia: number;
  mes: number;       // 1–12
  ano?: number;
}

/** Lê "DD/MM/YYYY" ou "DD/MM" → {dia, mes, ano?}; null se inválido. */
export function parseNascimento(valor?: string): NascimentoParts | null {
  if (!valor) return null;
  const partes = String(valor).trim().split(/[\/\-.]/).map(p => parseInt(p, 10));
  if (partes.length < 2 || partes.some(n => Number.isNaN(n))) return null;
  const [dia, mes, ano] = partes;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return ano ? { dia, mes, ano } : { dia, mes };
}

/** O funcionário faz aniversário na data de referência (padrão: hoje)? */
export function aniversariaHoje(f: Funcionario, ref: Date = new Date()): boolean {
  const n = parseNascimento(f.dataNascimento);
  if (!n) return false;
  return n.dia === ref.getDate() && n.mes === ref.getMonth() + 1;
}

/** Dias até o próximo aniversário (0 = hoje). null se data inválida. */
export function diasAteAniversario(f: Funcionario, ref: Date = new Date()): number | null {
  const n = parseNascimento(f.dataNascimento);
  if (!n) return null;
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let prox = new Date(ref.getFullYear(), n.mes - 1, n.dia);
  if (prox < base) prox = new Date(ref.getFullYear() + 1, n.mes - 1, n.dia);
  return Math.round((prox.getTime() - base.getTime()) / 86400000);
}

/** Idade que completa/completou no aniversário deste ano (precisa do ano). null se sem ano. */
export function idade(f: Funcionario, ref: Date = new Date()): number | null {
  const n = parseNascimento(f.dataNascimento);
  if (!n || !n.ano) return null;
  return ref.getFullYear() - n.ano;
}

/** Aniversariantes de um mês (1–12; padrão: mês atual), só ativos, ordenados por dia. */
export function aniversariantesDoMes(
  funcionarios: Funcionario[],
  mes: number = new Date().getMonth() + 1
): Funcionario[] {
  return funcionarios
    .filter(f => f.ativo !== false)
    .map(f => ({ f, n: parseNascimento(f.dataNascimento) }))
    .filter(x => x.n && x.n.mes === mes)
    .sort((a, b) => (a.n!.dia - b.n!.dia))
    .map(x => x.f);
}

/** Aniversariantes nos próximos `dias` (inclui hoje), só ativos, ordenados pela proximidade. */
export function aniversariantesProximos(
  funcionarios: Funcionario[],
  dias: number = 7,
  ref: Date = new Date()
): Funcionario[] {
  return funcionarios
    .filter(f => f.ativo !== false)
    .map(f => ({ f, d: diasAteAniversario(f, ref) }))
    .filter(x => x.d !== null && x.d <= dias)
    .sort((a, b) => (a.d! - b.d!))
    .map(x => x.f);
}
