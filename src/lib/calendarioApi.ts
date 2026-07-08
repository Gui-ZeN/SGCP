/**
 * Cliente READ-ONLY da API de Calendários RH (feriados, pontos facultativos,
 * datas comemorativas, dias de profissão). Fase 1: só leitura — nenhuma escrita
 * a partir do cliente. Base URL e chave vêm de env (VITE_*); se não configurada,
 * o app segue normal (o widget some). Padrão de região: CE / Fortaleza.
 *
 * ⚠️ A chave de leitura fica no bundle. Como são dados públicos (feriados), é
 *   aceitável no protótipo; o ideal futuro é proxiar pelo servidor.
 */

export type TipoData =
  | 'feriado' | 'ponto_facultativo' | 'data_comemorativa' | 'dia_profissao' | 'data_interna';

export interface DataCalendario {
  id: string;
  nome: string;         // já resolvido no locale pela API
  tipo: TipoData;
  natureza: string;
  data: string;         // YYYY-MM-DD (ocorrência resolvida no ano)
  categoria: string | null;
  descricao: string | null;
  cor_sugerida: string | null;
}

const env = (import.meta as any).env || {};
const BASE = String(env.VITE_CALENDARIO_API_URL || '').replace(/\/+$/, '');
const KEY = String(env.VITE_CALENDARIO_API_KEY || '');
const UF = String(env.VITE_CALENDARIO_UF || 'CE');
// Fortaleza. Passamos UF **e** município: a API só inclui feriado municipal quando
// o município é informado (uf sozinho exclui os municipais).
const MUNICIPIO_IBGE = String(env.VITE_CALENDARIO_MUNICIPIO_IBGE || '2304400');

export const calendarioConfigurado = (): boolean => BASE.length > 0;

async function getJson(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: KEY ? { 'X-API-Key': KEY } : undefined,
  });
  if (!res.ok) throw new Error(`Calendário API respondeu ${res.status}`);
  return res.json();
}

/** Próximas datas na janela de `dias` (região CE/Fortaleza por padrão). */
export async function fetchProximasDatas(dias = 45): Promise<DataCalendario[]> {
  if (!calendarioConfigurado()) return [];
  const qs = new URLSearchParams({ dias: String(dias), uf: UF, municipio_ibge: MUNICIPIO_IBGE });
  const data = await getJson(`/v1/datas/proximas?${qs.toString()}`);
  return Array.isArray(data) ? (data as DataCalendario[]) : [];
}

/** Todas as datas de um ano (para uma futura visão de calendário completo). */
export async function fetchDatasDoAno(ano: number): Promise<DataCalendario[]> {
  if (!calendarioConfigurado()) return [];
  const qs = new URLSearchParams({ ano: String(ano), uf: UF, municipio_ibge: MUNICIPIO_IBGE });
  const data = await getJson(`/v1/datas?${qs.toString()}`);
  return Array.isArray(data) ? (data as DataCalendario[]) : [];
}
