import React, { useMemo, useState } from 'react';
import { Integracao, Treinamento, Experiencia } from '../types';
import { integracaoPorSede, treinamentoPorSede, experienciaPorSede, totalGeral, filtrarPorMes, coletarAnos, CumprimentoSede } from '../utils/indicadores';
import { GraduationCap, ShieldCheck, BookOpen, ClipboardList } from 'lucide-react';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Bloco "Cumprimento por Sede" embutido na aba Indicadores (Dashboard) — no
 * formato do relatório mensal do RH (Integração, Experiência e Treinamentos por
 * campus). Sai junto no Exportar PDF. Filtro por mês/ano: Integração e Experiência
 * pela ADMISSÃO; Treinamentos pela DATA da ação.
 */
interface RelatorioIndicadoresProps {
  integracoes: Integracao[];
  treinamentos: Treinamento[];
  experiencias: Experiencia[];
  mostrarIntegracao?: boolean; // Integração é só Universidade
}

const corPct = (pct: number) =>
  pct >= 90 ? { anel: '#059669', txt: 'text-emerald-700' }
  : pct >= 70 ? { anel: '#1B4DD8', txt: 'text-[#1B4DD8]' }
  : { anel: '#D97706', txt: 'text-amber-700' };

const RingPct: React.FC<{ pct: number; size?: number }> = ({ pct, size = 52 }) => {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const cor = corPct(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor.anel} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className={`text-[13px] font-extrabold ${cor.txt}`} fill="currentColor">
        {pct}%
      </text>
    </svg>
  );
};

const Painel: React.FC<{
  titulo: string;
  Icone: React.FC<any>;
  rotuloTotal: string;
  rotuloOk: string;
  linhas: CumprimentoSede[];
  chips: { k: string; label: string; cor: string }[];
}> = ({ titulo, Icone, rotuloTotal, rotuloOk, linhas, chips }) => {
  const geral = totalGeral(linhas);
  return (
    <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0"><Icone className="w-4.5 h-4.5" /></div>
          <h3 className="text-sm font-bold text-slate-800 truncate">{titulo}</h3>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Geral</div>
            <div className="text-sm font-extrabold text-slate-800 tabular-nums">{geral.ok}<span className="text-slate-400 font-bold">/{geral.total}</span></div>
          </div>
          <RingPct pct={geral.pct} size={46} />
        </div>
      </div>

      {linhas.length === 0 ? (
        <p className="text-center text-slate-400 font-semibold py-10 text-sm">Sem registros para exibir.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-100">
          {linhas.map(l => (
            <div key={l.sede} className="bg-white p-4 flex items-center gap-3">
              <RingPct pct={l.pct} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-800 text-sm truncate">{l.sede}</div>
                <div className="text-[11px] text-slate-500 font-semibold">
                  {rotuloOk}: <span className="text-slate-800">{l.ok}</span> · {rotuloTotal}: <span className="text-slate-800">{l.total}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {chips.filter(c => (l.detalhe[c.k] || 0) > 0).map(c => (
                    <span key={c.k} className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${c.cor}`}>
                      {l.detalhe[c.k]} {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export const RelatorioIndicadores: React.FC<RelatorioIndicadoresProps> = ({ integracoes, treinamentos, experiencias, mostrarIntegracao = true }) => {
  const [mes, setMes] = useState<number | null>(null);
  const [ano, setAno] = useState<number | null>(null);

  const anos = useMemo(
    () => coletarAnos([
      ...integracoes.map(i => i.admissao),
      ...treinamentos.map(t => t.dataInicio),
      ...experiencias.map(e => e.dataAdmissao),
    ]),
    [integracoes, treinamentos, experiencias]
  );

  const integ = useMemo(() => integracaoPorSede(filtrarPorMes(integracoes, i => i.admissao, mes, ano)), [integracoes, mes, ano]);
  const trein = useMemo(() => treinamentoPorSede(filtrarPorMes(treinamentos, t => t.dataInicio, mes, ano)), [treinamentos, mes, ano]);
  const expp = useMemo(() => experienciaPorSede(filtrarPorMes(experiencias, e => e.dataAdmissao, mes, ano)), [experiencias, mes, ano]);

  const periodoLabel = mes || ano
    ? `${mes ? MESES[mes - 1] : 'Todos os meses'}${ano ? ` / ${ano}` : ''}`
    : 'Acumulado (todos os registros)';
  const selCls = 'text-xs bg-white border border-slate-250 py-1.5 px-2.5 rounded-xl font-bold text-slate-700 focus:border-slate-800 focus:outline-none shadow-sm cursor-pointer';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-500 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-slate-800 leading-tight">Cumprimento por Sede</h3>
            <p className="text-xs text-slate-500 font-medium">Período: <span className="font-bold text-slate-700">{periodoLabel}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <select value={mes ?? ''} onChange={e => setMes(e.target.value ? Number(e.target.value) : null)} className={selCls} aria-label="Filtrar por mês">
            <option value="">Mês: todos</option>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano ?? ''} onChange={e => setAno(e.target.value ? Number(e.target.value) : null)} className={selCls} aria-label="Filtrar por ano">
            <option value="">Ano: todos</option>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <Painel
        titulo="Experiência — período de teste"
        Icone={ShieldCheck}
        rotuloTotal="Programadas" rotuloOk="Com desfecho"
        linhas={expp}
        chips={[
          { k: 'efetivadas', label: 'efetiv.', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { k: 'prorrogadas', label: 'prorrog.', cor: 'bg-amber-50 text-amber-700 border-amber-200' },
          { k: 'desligadas', label: 'deslig.', cor: 'bg-rose-50 text-rose-700 border-rose-200' },
          { k: 'emAnalise', label: 'em análise', cor: 'bg-slate-100 text-slate-600 border-slate-200' },
        ]}
      />

      <Painel
        titulo="Treinamentos — presença"
        Icone={BookOpen}
        rotuloTotal="Previstos" rotuloOk="Treinados"
        linhas={trein}
        chips={[{ k: 'turmas', label: 'turmas', cor: 'bg-slate-100 text-slate-600 border-slate-200' }]}
      />

      {mostrarIntegracao && (
        <Painel
          titulo="Integração — onboarding"
          Icone={GraduationCap}
          rotuloTotal="Programados" rotuloOk="Realizados"
          linhas={integ}
          chips={[
            { k: 'realizados', label: 'realiz.', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { k: 'naoRealizados', label: 'pendentes', cor: 'bg-amber-50 text-amber-700 border-amber-200' },
            { k: 'desligados', label: 'deslig.', cor: 'bg-rose-50 text-rose-700 border-rose-200' },
          ]}
        />
      )}
    </div>
  );
};
