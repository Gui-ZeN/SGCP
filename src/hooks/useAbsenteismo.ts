import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import type { Periodo } from '../utils/filtroIndicadores';

/**
 * Absenteísmo da Infraestrutura, vindo do Chromos pela ponte `/api/absenteismo`
 * (06/10/2026). O SGPC não guarda nem calcula nada disto: a taxa é a da tela de
 * Absenteísmo do Chromos, e chega pronta.
 */

export type ClasseFalta = 'atestado' | 'injustificada' | 'outro';
export type PorTipo = Record<ClasseFalta, { faltas: number; horas: number }>;
export interface MesAbs { mes: string; headcount: number; horasPerdidas: number; horasEsperadas: number; taxa: number | null; porTipo?: PorTipo }
export interface PessoaAbs { nome: string; matricula: string; sede: string; cargo: string; faltas: number; horas: number; taxa: number; porTipo: PorTipo }
export interface SedeAbs { sede: string; regiao: string; meses: MesAbs[]; horasPerdidas: number; horasEsperadas: number; taxa: number | null }
export interface Absenteismo {
  periodo: { de: string; ate: string };
  instituicao: 'Christus' | 'Unichristus' | null;
  meses: MesAbs[];
  geral: { horasPerdidas: number; horasEsperadas: number; taxa: number | null };
  sedes: SedeAbs[];
  semDono: number;
  porTipo: PorTipo;
  pessoas: PessoaAbs[];
  semana: { dia: string; contagem: Record<ClasseFalta, number> }[];
  geradoEm: string;
}

/**
 * O período dos Indicadores em meses AAAA-MM. Ano inteiro vai até o mês de
 * hoje (mês futuro só teria denominador zero); "todos os anos" vira os últimos
 * 12 meses — o Chromos não tem histórico anterior que valha somar.
 */
export function mesesDoPeriodo(p: Periodo, hojeISO: string): { de: string; ate: string } | null {
  const atual = hojeISO.slice(0, 7);
  const mm = (n: number) => String(n).padStart(2, '0');
  if (p.ano === null) {
    const [a, m] = atual.split('-').map(Number);
    const ini = new Date(Date.UTC(a, m - 12, 1));
    return { de: `${ini.getUTCFullYear()}-${mm(ini.getUTCMonth() + 1)}`, ate: atual };
  }
  if (p.mes !== null) {
    const unico = `${p.ano}-${mm(p.mes)}`;
    return unico > atual ? null : { de: unico, ate: unico };
  }
  const de = `${p.ano}-01`;
  if (de > atual) return null;
  const fim = `${p.ano}-12`;
  return { de, ate: fim < atual ? fim : atual };
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; dados: Absenteismo }
  | { tipo: 'erro'; texto: string }
  | { tipo: 'futuro' };

const RECADO: Record<number, string> = {
  503: 'A ligação com o Chromos ainda não foi configurada.',
  403: 'Seu usuário não tem cadastro no SGPC para ver este indicador.',
  401: 'Sua sessão não foi reconhecida. Saia e entre de novo.',
  404: 'O indicador não está disponível neste ambiente (só na versão publicada).',
};

export function useAbsenteismo(periodo: Periodo, hojeISO: string): Estado {
  const alvo = mesesDoPeriodo(periodo, hojeISO);
  const chave = alvo ? `${alvo.de}|${alvo.ate}` : '';
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    if (!alvo) { setEstado({ tipo: 'futuro' }); return; }
    let vivo = true;
    setEstado({ tipo: 'carregando' });
    (async () => {
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (!token) throw Object.assign(new Error('sem sessão'), { status: 401 });
        const r = await fetch(`/api/absenteismo?de=${alvo.de}&ate=${alvo.ate}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw Object.assign(new Error(`status ${r.status}`), { status: r.status });
        const dados = (await r.json()) as Absenteismo;
        if (vivo) setEstado({ tipo: 'pronto', dados });
      } catch (e: any) {
        if (vivo) setEstado({ tipo: 'erro', texto: RECADO[e?.status] || 'O Chromos não respondeu agora. Tente de novo em alguns minutos.' });
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return estado;
}
