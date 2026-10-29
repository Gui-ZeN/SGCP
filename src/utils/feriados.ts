/**
 * Feriados de um mês para o calendário do relatório mensal (29/10/2026): o RH
 * só listava os feriados à mão. Nacionais, do Ceará e de Fortaleza, os móveis
 * pela Páscoa, e as datas que o deck já trazia (Crianças, Professores). O
 * campo continua editável: ponto facultativo e recesso são do RH.
 */
export interface Feriado { dia: number; nome: string }

const FIXOS: [number, number, string][] = [
  [1, 1, 'Confraternização Universal'],
  [3, 19, 'Dia de São José (Ceará)'],
  [3, 25, 'Data Magna do Ceará'],
  [4, 13, 'Aniversário de Fortaleza'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [8, 15, 'Nossa Senhora da Assunção (Fortaleza)'],
  [9, 7, 'Independência do Brasil'],
  [10, 12, 'Nossa Senhora Aparecida / Dia das Crianças'],
  [10, 15, 'Dia dos Professores'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Dia da Consciência Negra'],
  [12, 25, 'Natal'],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), mês 1–12. */
export function pascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { mes: Math.floor((h + l - 7 * m + 114) / 31), dia: ((h + l - 7 * m + 114) % 31) + 1 };
}

export function feriadosDoMes(ano: number, mes: number): Feriado[] {
  const p = pascoa(ano), base = new Date(Date.UTC(ano, p.mes - 1, p.dia));
  const moveis: [number, string][] = [[-48, 'Carnaval'], [-47, 'Carnaval'], [-2, 'Sexta-feira Santa'], [60, 'Corpus Christi']];
  const lista: Feriado[] = FIXOS.filter(([m]) => m === mes).map(([, dia, nome]) => ({ dia, nome }));
  for (const [dias, nome] of moveis) {
    const d = new Date(base.getTime() + dias * 86400000);
    if (d.getUTCMonth() + 1 === mes) lista.push({ dia: d.getUTCDate(), nome });
  }
  return lista.sort((a, b) => a.dia - b.dia);
}

/** As linhas do campo do calendário: "15/11 - Proclamação da República". */
export const linhasDosFeriados = (ano: number, mes: number) =>
  feriadosDoMes(ano, mes).map(f => `${String(f.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')} - ${f.nome}`).join('\n');
