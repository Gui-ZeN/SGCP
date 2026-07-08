import type { TipoData } from '../lib/calendarioApi';

/** Helpers puros de apresentação do calendário (sem rede/UI) — testáveis. */

const ROTULO: Record<TipoData, string> = {
  feriado: 'Feriado',
  ponto_facultativo: 'Ponto facultativo',
  data_comemorativa: 'Data comemorativa',
  dia_profissao: 'Dia da profissão',
  data_interna: 'Data interna',
};

const COR_PADRAO: Record<TipoData, string> = {
  feriado: '#E11D48',           // rose
  ponto_facultativo: '#D97706', // amber
  data_comemorativa: '#1B4DD8', // cobalto
  dia_profissao: '#059669',     // emerald
  data_interna: '#7C3AED',      // violet
};

export function rotuloTipo(tipo: TipoData): string {
  return ROTULO[tipo] ?? tipo;
}

/** Cor do marcador: a sugerida pela API tem prioridade; senão, o padrão do tipo. */
export function corDaData(tipo: TipoData, corSugerida?: string | null): string {
  return corSugerida && /^#[0-9A-Fa-f]{6}$/.test(corSugerida) ? corSugerida : (COR_PADRAO[tipo] ?? '#64748B');
}

/** Dias entre hoje e a data ISO (YYYY-MM-DD). 0 = hoje, negativo = passado. */
export function diasAteData(dataISO: string, hoje: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataISO || '');
  if (!m) return null;
  const alvo = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo.getTime() - base.getTime()) / 86400000);
}

/** "hoje", "amanhã", "em N dias" — rótulo relativo curto. */
export function rotuloRelativo(dias: number): string {
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

/** "seg, 24/06" a partir de YYYY-MM-DD (dia da semana abreviado + dd/mm). */
export function dataCurtaBR(dataISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataISO || '');
  if (!m) return dataISO || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const semana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()];
  return `${semana}, ${m[3]}/${m[2]}`;
}
