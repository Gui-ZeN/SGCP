import type { Integracao, Treinamento, Experiencia } from '../types';

/**
 * Agregações "por sede, com % de cumprimento" — reproduzem o relatório mensal
 * de indicadores do RH (Integração, Experiência e Treinamentos por campus).
 * Funções PURAS e testáveis; a UI (aba Relatório) só renderiza.
 */

export interface CumprimentoSede {
  sede: string;
  total: number;   // programados / previstos
  ok: number;      // realizados / treinados / com desfecho
  pct: number;     // ok/total × 100 (0 se total 0), arredondado
  detalhe: Record<string, number>; // quebras extras (desligados, prorrogados…)
}

const pct = (ok: number, total: number) => (total > 0 ? Math.round((ok / total) * 100) : 0);
const nomeSede = (s?: string) => (s || '').trim() || '—';

/** Ordena por volume (total desc) e desempata por nome — como o deck lista os campi. */
function ordenar(linhas: CumprimentoSede[]): CumprimentoSede[] {
  return [...linhas].sort((a, b) => b.total - a.total || a.sede.localeCompare(b.sede, 'pt-BR'));
}

/** Integração: programados = total; realizados = status "Realizado". */
export function integracaoPorSede(list: Integracao[]): CumprimentoSede[] {
  const map = new Map<string, CumprimentoSede>();
  for (const i of list) {
    const sede = nomeSede(i.sede);
    const l = map.get(sede) || { sede, total: 0, ok: 0, pct: 0, detalhe: { realizados: 0, naoRealizados: 0, desligados: 0 } };
    l.total++;
    if (i.status === 'Realizado') { l.ok++; l.detalhe.realizados++; }
    else if (i.status === 'Desligado') l.detalhe.desligados++;
    else l.detalhe.naoRealizados++;
    map.set(sede, l);
  }
  return ordenar([...map.values()].map(l => ({ ...l, pct: pct(l.ok, l.total) })));
}

/** Treinamentos: previstos = Σ qtdPrevista; treinados = Σ qtdRealizada (agrupado por unidade/campus). */
export function treinamentoPorSede(list: Treinamento[]): CumprimentoSede[] {
  const map = new Map<string, CumprimentoSede>();
  for (const t of list) {
    const sede = nomeSede(t.unidade);
    const l = map.get(sede) || { sede, total: 0, ok: 0, pct: 0, detalhe: { turmas: 0 } };
    l.total += Number(t.qtdPrevista) || 0;
    l.ok += Number(t.qtdRealizada) || 0;
    l.detalhe.turmas++;
    map.set(sede, l);
  }
  return ordenar([...map.values()].map(l => ({ ...l, pct: pct(l.ok, l.total) })));
}

/**
 * Experiência: programadas = total; "com desfecho" (ok) = efetivadas + prorrogadas
 * + desligadas (tudo que não está mais EM_ANALISE). Detalhe traz cada status.
 */
export function experienciaPorSede(list: Experiencia[]): CumprimentoSede[] {
  const map = new Map<string, CumprimentoSede>();
  for (const e of list) {
    const sede = nomeSede(e.sede);
    const l = map.get(sede) || { sede, total: 0, ok: 0, pct: 0, detalhe: { emAnalise: 0, prorrogadas: 0, efetivadas: 0, desligadas: 0 } };
    l.total++;
    if (e.status === 'EM_ANALISE') l.detalhe.emAnalise++;
    else {
      l.ok++;
      if (e.status === 'PRORROGADO') l.detalhe.prorrogadas++;
      else if (e.status === 'EFETIVADO') l.detalhe.efetivadas++;
      else if (e.status === 'ENCERRADO') l.detalhe.desligadas++;
    }
    map.set(sede, l);
  }
  return ordenar([...map.values()].map(l => ({ ...l, pct: pct(l.ok, l.total) })));
}

/* ─────────────── Filtro por período (mês/ano) ─────────────── */

function mesAnoDe(dataBR?: string): { mes: number; ano: number } | null {
  if (!dataBR) return null;
  const p = String(dataBR).trim().split(/[\/\-.]/);
  if (p.length < 3) return null;
  const m = parseInt(p[1], 10), a = parseInt(p[2], 10);
  if (!m || !a || m < 1 || m > 12) return null;
  return { mes: m, ano: a };
}

/** Filtra por mês (1–12) e/ou ano; null = "todos". Registro sem data válida sai quando há filtro. */
export function filtrarPorMes<T>(list: T[], getData: (x: T) => string | undefined, mes: number | null, ano: number | null): T[] {
  if (!mes && !ano) return list;
  return list.filter(x => {
    const ma = mesAnoDe(getData(x));
    if (!ma) return false;
    if (ano && ma.ano !== ano) return false;
    if (mes && ma.mes !== mes) return false;
    return true;
  });
}

/** Anos distintos presentes numa lista de datas DD/MM/YYYY, desc. */
export function coletarAnos(datas: (string | undefined)[]): number[] {
  const set = new Set<number>();
  for (const d of datas) { const ma = mesAnoDe(d); if (ma) set.add(ma.ano); }
  return [...set].sort((a, b) => b - a);
}

/* ─────────── Funil de presença por cargo (deck pág. 7–8) ─────────── */

export interface PresencaCargo {
  cargo: string;
  convocados: number;  // Σ candChamados
  presentes: number;   // Σ candCompareceram
  ausentes: number;    // convocados − presentes
  taxa: number;        // presentes/convocados × 100
}

/** Convocados/Presentes/Ausentes + Taxa de Presença por cargo (ordenado por convocados desc). */
export function taxaPresencaPorCargo(
  vagas: { vaga?: string; candChamados?: number; candCompareceram?: number }[]
): PresencaCargo[] {
  const map = new Map<string, { convocados: number; presentes: number }>();
  for (const v of vagas) {
    const conv = Number(v.candChamados) || 0;
    const pres = Number(v.candCompareceram) || 0;
    if (!conv && !pres) continue; // só cargos que tiveram funil registrado
    const cargo = (v.vaga || '—').trim() || '—';
    const l = map.get(cargo) || { convocados: 0, presentes: 0 };
    l.convocados += conv; l.presentes += pres;
    map.set(cargo, l);
  }
  return [...map.entries()]
    .map(([cargo, l]) => ({
      cargo,
      convocados: l.convocados,
      presentes: l.presentes,
      ausentes: Math.max(0, l.convocados - l.presentes),
      taxa: l.convocados > 0 ? Math.round((l.presentes / l.convocados) * 100) : 0,
    }))
    .sort((a, b) => b.convocados - a.convocados);
}

/* ─────────── Taxa de turnover ─────────── */

export interface TaxaTurnover {
  mesAno: string;           // mês de referência ('' quando não há dado)
  taxa: number;             // ((admissões + saídas) / 2) / efetivo × 100, 1 casa
  admissoes: number;
  saidas: number;           // pediramSair + foramDesligados
  totalFuncionarios: number;
  temDados: boolean;        // false = nada a exibir (a UI mostra o vazio)
}

/** Ordena "MM/YYYY" cronologicamente; entradas fora do formato vão para o fim. */
function ordemMesAno(mesAno?: string): number {
  const m = /^(\d{2})\/(\d{4})$/.exec((mesAno || '').trim());
  if (!m) return -Infinity;
  return Number(m[2]) * 12 + (Number(m[1]) - 1);
}

/**
 * Taxa de turnover do mês MAIS RECENTE registrado em /turnover.
 *
 * Fórmula: ((admissões + saídas) / 2) / efetivo — a MESMA já usada e rotulada
 * no módulo Turnover (`TurnoverSection.tsx`). Não é a taxa de desligamento
 * (saídas / efetivo): duas fórmulas sob a palavra "Turnover" dariam dois
 * números diferentes na mesma tela.
 *
 * É uma taxa MENSAL — por isso `mesAno` volta junto: sem o mês à vista, o
 * número é lido como acumulado do ano.
 *
 * Escolhe o mês pelo próprio `mesAno`, não pela posição no array: a ordem que
 * chega do onSnapshot não é cronológica.
 */
export function taxaTurnover(list: { mesAno?: string; totalFuncionarios?: number; totalAdmissao?: number; pediramSair?: number; foramDesligados?: number }[]): TaxaTurnover {
  const vazio: TaxaTurnover = { mesAno: '', taxa: 0, admissoes: 0, saidas: 0, totalFuncionarios: 0, temDados: false };
  if (!list || list.length === 0) return vazio;

  const recente = [...list].sort((a, b) => ordemMesAno(a.mesAno) - ordemMesAno(b.mesAno)).pop();
  if (!recente) return vazio;

  const mesAno = (recente.mesAno || '').trim();

  // SOMA todos os registros do mês, não só o último: desde que o turnover pode
  // ser lançado por unidade, o mesmo mês tem dois registros (Colégio e
  // Universidade). Pegar só um mostraria metade do grupo com cara de total —
  // e o card diz "todas as unidades".
  const doMes = list.filter(t => (t.mesAno || '').trim() === mesAno);
  const somar = (f: (t: typeof doMes[number]) => number) =>
    doMes.reduce((acc, t) => acc + (Number(f(t)) || 0), 0);

  const totalFuncionarios = somar(t => t.totalFuncionarios || 0);
  const admissoes = somar(t => t.totalAdmissao || 0);
  const saidas = somar(t => t.pediramSair || 0) + somar(t => t.foramDesligados || 0);
  if (totalFuncionarios <= 0) return { ...vazio, mesAno, admissoes, saidas };

  return {
    mesAno,
    taxa: Math.round((((admissoes + saidas) / 2) / totalFuncionarios) * 1000) / 10,
    admissoes,
    saidas,
    totalFuncionarios,
    temDados: true,
  };
}

/** Soma uma coluna "GERAL" (todas as sedes) a partir das linhas por sede. */
export function totalGeral(linhas: CumprimentoSede[]): CumprimentoSede {
  const total = linhas.reduce((s, l) => s + l.total, 0);
  const ok = linhas.reduce((s, l) => s + l.ok, 0);
  const detalhe: Record<string, number> = {};
  for (const l of linhas) for (const [k, v] of Object.entries(l.detalhe)) detalhe[k] = (detalhe[k] || 0) + v;
  return { sede: 'GERAL', total, ok, pct: pct(ok, total), detalhe };
}

/* ─────────── Funil de seleção (aba QUANTI da planilha de Seleções) ─────────── */

export interface FunilSelecao {
  eventos: number;
  convocados: number;
  compareceram: number;
  ausentes: number;
  contratados: number;
  desistiram: number;
  /** compareceram / convocados, em % inteiro (mesmo `pct` do resto do módulo).
   *  0 quando não há convocados. */
  taxaComparecimento: number;
  /** contratados / compareceram, em % inteiro. */
  taxaContratacao: number;
  /** Eventos em que convocados ≠ compareceram + ausentes. */
  inconsistentes: number;
}

interface EventoSelecao {
  convocados?: number;
  compareceram?: number;
  ausentes?: number;
  contratados?: number;
  desistiram?: number;
}

/**
 * Consolida eventos de seleção.
 *
 * A taxa de comparecimento é sobre os CONVOCADOS — a leitura natural do RH
 * ("convoquei 11, vieram 2"). A alternativa (sobre compareceram + ausentes)
 * seria internamente coerente, mas ignoraria o número que o RH registrou.
 *
 * Só que os dois nem sempre batem: medido em 27/08/2026, 48 das 220 linhas têm
 * `convocados ≠ compareceram + ausentes` (há casos de `conv=11 comp=2 aus=6` e
 * até `conv=0 comp=1`). Por isso `inconsistentes` volta junto e a tela mostra:
 * taxa parcial sem aviso vira taxa errada.
 */
export function funilSelecao(list: EventoSelecao[]): FunilSelecao {
  const soma = (f: (e: EventoSelecao) => number) => list.reduce((acc, e) => acc + (Number(f(e)) || 0), 0);

  const convocados = soma(e => e.convocados || 0);
  const compareceram = soma(e => e.compareceram || 0);
  const ausentes = soma(e => e.ausentes || 0);

  return {
    eventos: list.length,
    convocados,
    compareceram,
    ausentes,
    contratados: soma(e => e.contratados || 0),
    desistiram: soma(e => e.desistiram || 0),
    taxaComparecimento: pct(compareceram, convocados),
    taxaContratacao: pct(soma(e => e.contratados || 0), compareceram),
    inconsistentes: list.filter(e =>
      (Number(e.convocados) || 0) !== (Number(e.compareceram) || 0) + (Number(e.ausentes) || 0)
    ).length,
  };
}

/** Agrupa o funil por uma chave (sede, mês, responsável), da maior para a menor. */
export function funilPorChave<T extends EventoSelecao>(
  list: T[],
  chave: (e: T) => string
): { name: string; convocados: number; compareceram: number; taxa: number }[] {
  const grupos = new Map<string, T[]>();
  list.forEach(e => {
    const k = chave(e) || 'Não informado';
    (grupos.get(k) || grupos.set(k, []).get(k)!).push(e);
  });

  return [...grupos.entries()]
    .map(([name, itens]) => {
      const f = funilSelecao(itens);
      return { name, convocados: f.convocados, compareceram: f.compareceram, taxa: f.taxaComparecimento };
    })
    .sort((a, b) => b.convocados - a.convocados);
}

/** Motivos de desistência somados, do mais frequente ao menos. */
export function motivosDesistencia(list: { motivos?: Record<string, number> }[]): { name: string; total: number }[] {
  const soma = new Map<string, number>();
  list.forEach(e => {
    Object.entries(e.motivos || {}).forEach(([motivo, n]) => {
      soma.set(motivo, (soma.get(motivo) || 0) + (Number(n) || 0));
    });
  });
  return [...soma.entries()]
    .map(([name, total]) => ({ name, total }))
    .filter(m => m.total > 0)
    .sort((a, b) => b.total - a.total);
}
