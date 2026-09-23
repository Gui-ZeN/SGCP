/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Filtros do painel de Indicadores: SEDE e PERÍODO valendo para todos os
 * módulos juntos (decisão de 23/09/2026).
 *
 * A sede é texto livre em quase todo módulo — "DT" e "DIONISIO TORRES", "Pré
 * Nunes" e "PN", "Pré - Sul" e "PRE SUL". O filtro antigo listava a string crua
 * de cada vaga (DT, BS, PN e PQL apareciam duas vezes) e comparava por
 * igualdade exata: escolher "DT" escondia as vagas gravadas como "DIONISIO
 * TORRES", e o número filtrado saía ERRADO, não só a lista feia. Aqui tudo passa
 * pela sigla do cadastro, ignorando acento, caixa e hífen.
 */
import type { Sede } from '../hooks/useMetadata';
import { normalizarNome } from './catalogo';

/**
 * Sem acento, caixa e hífen: "Pré - Sul" e "PRE SUL" são a mesma sede. Número
 * romano no fim vira arábico ("PQL II" = "PQL 2") e o "Equipe" da frente cai
 * ("D.VALERIA" = "EQUIPE D.VALERIA").
 */
export const chaveDeSede = (s: string) => normalizarNome(s)
  .replace(/\s*-\s*/g, ' ')
  .replace(/\b(iii|ii)$/, r => (r === 'ii' ? '2' : '3'))
  .replace(/^equipe\s+/, '')
  .trim();

/**
 * Rótulos que não são UMA sede: vazio, "-", "A definir" — e "Todas as sedes",
 * que é registro que vale para todas e não uma opção de filtro.
 */
const SEM_SEDE = new Set(['', '-', 'a definir', 'nao informado', 'nao informada', 'todas as sedes', 'tas']);
export const ehSemSede = (s?: string) => SEM_SEDE.has(chaveDeSede(s || ''));

const doCadastro = (sedes: Sede[], k: string) =>
  sedes.find(s => chaveDeSede(s.nome || '') === k || chaveDeSede(s.sigla || '') === k);

/**
 * A sigla do cadastro para uma sede escrita de qualquer jeito. O que o cadastro
 * não conhece ("KMC2", "CD") fica com o próprio nome — é sede de verdade que
 * só não foi cadastrada, e sumir com ela esconderia número.
 *
 * "DIONISIO TORRES / CPA" é a sede mais o LOCAL dentro dela: vale a sede. Já
 * "DT/BS" são duas sedes — fica como está, porque escolher uma mentiria.
 */
export function siglaDaSede(sedes: Sede[], rotulo?: string): string {
  const k = chaveDeSede(rotulo || '');
  if (!k) return '';
  const achada = doCadastro(sedes, k);
  if (achada) return achada.sigla || achada.nome;
  const partes = (rotulo || '').split('/').map(p => chaveDeSede(p)).filter(Boolean);
  if (partes.length === 2) {
    const [a, b] = partes.map(p => doCadastro(sedes, p));
    if (a && !b) return a.sigla || a.nome;
  }
  return (rotulo || '').trim();
}

export interface OpcaoDeSede {
  /** A sigla — é o valor do filtro. */
  valor: string;
  /** "DT · Dionisio Torres" quando o cadastro tem nome e sigla. */
  rotulo: string;
  /** Registros que caem nela, somando todos os módulos. */
  registros: number;
}

/**
 * As opções do filtro: uma por sede de verdade, com quantos registros cada uma
 * tem. Só aparecem sedes que existem nos dados — uma opção que filtra para
 * vazio é um beco sem saída.
 */
export function opcoesDeSede(sedes: Sede[], rotulos: (string | undefined)[]): OpcaoDeSede[] {
  const porSigla = new Map<string, number>();
  for (const r of rotulos) {
    if (ehSemSede(r)) continue;
    const s = siglaDaSede(sedes, r);
    if (s) porSigla.set(chaveDeSede(s), (porSigla.get(chaveDeSede(s)) || 0) + 1);
  }
  const opcoes: OpcaoDeSede[] = [];
  const vistos = new Set<string>();
  for (const r of rotulos) {
    if (ehSemSede(r)) continue;
    const sigla = siglaDaSede(sedes, r);
    const k = chaveDeSede(sigla);
    if (!sigla || vistos.has(k)) continue;
    vistos.add(k);
    const cad = sedes.find(s => chaveDeSede(s.sigla || s.nome || '') === k);
    const nome = cad?.nome && cad.sigla && chaveDeSede(cad.nome) !== k ? titulo(cad.nome) : '';
    opcoes.push({ valor: sigla, rotulo: nome ? `${sigla} · ${nome}` : sigla, registros: porSigla.get(k) || 0 });
  }
  return opcoes.sort((a, b) => a.valor.localeCompare(b.valor, 'pt-BR', { numeric: true }));
}

/** Filtro de sede: `null` = todas. */
export function naSede(sedes: Sede[], alvo: string | null) {
  if (!alvo) return () => true;
  // O alvo também passa pelo cadastro: a sede do usuário pode chegar como nome
  // ("DIONISIO TORRES") e os registros resolvem para a sigla ("DT").
  const k = chaveDeSede(siglaDaSede(sedes, alvo));
  return (rotulo?: string) => chaveDeSede(siglaDaSede(sedes, rotulo)) === k;
}

function titulo(s: string): string {
  return s.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase());
}

// ─── período ────────────────────────────────────────────────────────────────

export interface Periodo {
  /** null = todos os anos. */
  ano: number | null;
  /** 1–12; null = o ano inteiro. Só vale com ano. */
  mes: number | null;
}

/** DD/MM/AAAA (ou AAAA-MM-DD) → [ano, mês]; null se não for data. */
export function anoMes(data?: string): [number, number] | null {
  const s = (data || '').trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return [Number(m[3]), Number(m[2])];
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return [Number(m[1]), Number(m[2])];
  return null;
}

/** MM/AAAA (turnover) → [ano, mês]. */
export function anoMesDeMesAno(mesAno?: string): [number, number] | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec((mesAno || '').trim());
  return m ? [Number(m[2]), Number(m[1])] : null;
}

/** A data cai no período? Sem data: só entra quando o período é "tudo". */
export function noPeriodo(p: Periodo, am: [number, number] | null): boolean {
  if (p.ano === null) return true;
  if (!am) return false;
  return am[0] === p.ano && (p.mes === null || am[1] === p.mes);
}

export const dataNoPeriodo = (p: Periodo, data?: string) => noPeriodo(p, anoMes(data));

/** Os anos que existem nos dados, do mais recente para o mais antigo. */
export function anosDosDados(datas: (string | undefined)[]): number[] {
  const anos = new Set<number>();
  for (const d of datas) { const am = anoMes(d) || anoMesDeMesAno(d); if (am && am[0] > 2000 && am[0] < 2100) anos.add(am[0]); }
  return [...anos].sort((a, b) => b - a);
}

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "setembro de 2026", "2026", "todo o período". */
export function rotuloDoPeriodo(p: Periodo): string {
  if (p.ano === null) return 'todo o período';
  return p.mes ? `${MESES_LONGOS[p.mes - 1]} de ${p.ano}` : String(p.ano);
}
