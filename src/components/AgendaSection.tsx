import React, { useMemo, useState } from 'react';
import type { Selecao, Vaga, Integracao, Entrevista, Consulta, Experiencia } from '../types';
import { montarAgendaDoDia, resumoEmTexto, type TipoEvento } from '../utils/agenda';
import { formatDateBR, toISOInput, dataISOLocal } from '../utils/date';
import {
  CalendarDays, ChevronLeft, ChevronRight, Users, Briefcase, CheckCircle2,
  GraduationCap, LogOut, ClipboardList, Clock
} from 'lucide-react';

/**
 * Agenda diária do RH (BETA) — o dia de trabalho, não o resumo do mês.
 *
 * Só leitura: cada linha aqui já foi registrada em outro módulo. Não há
 * formulário — o RH não precisa alimentar mais nada para o dia aparecer.
 */
interface AgendaSectionProps {
  selecoes: Selecao[];
  vagas: Vaga[];
  integracoes: Integracao[];
  entrevistas: Entrevista[];
  consultas: Consulta[];
  experiencias: Experiencia[];
}

const ESTILO: Record<TipoEvento, { Icone: typeof Users; cor: string; rotulo: string }> = {
  'selecao':           { Icone: Users,        cor: 'bg-indigo-50 text-indigo-700 border-indigo-200', rotulo: 'Seleção' },
  'integracao':        { Icone: GraduationCap, cor: 'bg-orange-50 text-orange-700 border-orange-200', rotulo: 'Integração' },
  'entrevista':        { Icone: LogOut,       cor: 'bg-rose-50 text-rose-700 border-rose-200',       rotulo: 'Desligamento' },
  'vaga-aberta':       { Icone: Briefcase,    cor: 'bg-sky-50 text-sky-700 border-sky-200',          rotulo: 'Vaga aberta' },
  'vaga-concluida':    { Icone: CheckCircle2, cor: 'bg-emerald-50 text-emerald-700 border-emerald-200', rotulo: 'Vaga concluída' },
  'consulta-aberta':   { Icone: ClipboardList, cor: 'bg-slate-100 text-slate-600 border-slate-200',  rotulo: 'Consulta' },
  'consulta-atendida': { Icone: ClipboardList, cor: 'bg-emerald-50 text-emerald-700 border-emerald-200', rotulo: 'Consulta atendida' },
  'experiencia-45':    { Icone: Clock,        cor: 'bg-amber-50 text-amber-700 border-amber-200',    rotulo: 'Prazo 45 dias' },
  'experiencia-90':    { Icone: Clock,        cor: 'bg-amber-50 text-amber-700 border-amber-200',    rotulo: 'Prazo 90 dias' },
};

/** Soma dias a uma data ISO (YYYY-MM-DD) sem passar por fuso. */
function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const base = new Date(a, m - 1, d + dias);
  return dataISOLocal(base);
}

export const AgendaSection: React.FC<AgendaSectionProps> = (fontes) => {
  const [diaISO, setDiaISO] = useState(() => dataISOLocal());
  const hojeISO = dataISOLocal();

  const dia = formatDateBR(diaISO);
  const { resumo, eventos } = useMemo(() => montarAgendaDoDia(dia, fontes), [dia, fontes]);

  const nomeDoDia = useMemo(() => {
    const [a, m, d] = diaISO.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
    });
  }, [diaISO]);

  const cards = [
    { n: resumo.convocados, t: 'Convocados', cor: 'text-slate-800' },
    { n: resumo.compareceram, t: 'Compareceram', cor: 'text-emerald-600' },
    { n: resumo.vagasAbertas, t: 'Vagas abertas', cor: 'text-sky-600' },
    { n: resumo.vagasConcluidas, t: 'Vagas concluídas', cor: 'text-emerald-600' },
    { n: resumo.integracoes, t: 'Integrações', cor: 'text-orange-600' },
    { n: resumo.prazos, t: 'Prazos', cor: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-500" />
            Agenda do RH
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              Beta
            </span>
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            O que o RH fez em cada dia — montado do que já é registrado nos outros módulos.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => setDiaISO(d => somarDias(d, -1))}
            aria-label="Dia anterior"
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={toISOInput(dia)}
            onChange={e => e.target.value && setDiaISO(e.target.value)}
            aria-label="Escolher o dia"
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer outline-none focus:border-slate-800"
          />
          <button
            onClick={() => setDiaISO(d => somarDias(d, 1))}
            aria-label="Próximo dia"
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 cursor-pointer transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {diaISO !== hojeISO && (
            <button
              onClick={() => setDiaISO(hojeISO)}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition"
            >
              Hoje
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
          {nomeDoDia}{diaISO === hojeISO && ' · hoje'}
        </p>
        <p className="text-sm font-bold text-slate-700 mt-1">{resumoEmTexto(resumo)}</p>

        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
          {cards.map(c => (
            <div key={c.t} className="bg-slate-50 rounded-xl p-3 text-center">
              <span className={`block text-xl font-black ${c.n ? c.cor : 'text-slate-300'}`}>{c.n}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{c.t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {eventos.length === 0 ? (
          <div className="py-14 text-center">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">Nada registrado neste dia.</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              A agenda mostra o que foi lançado nos módulos — não é um diário à parte.
            </p>
          </div>
        ) : eventos.map((evento, i) => {
          const { Icone, cor, rotulo } = ESTILO[evento.tipo];
          return (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5">
              <span className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${cor}`}>
                <Icone className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{evento.titulo}</p>
                {evento.contexto && (
                  <p className="text-[11px] text-slate-500 font-semibold">{evento.contexto}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{rotulo}</span>
                {evento.numeros && (
                  <p className="text-[11px] font-bold text-slate-600 tabular-nums">{evento.numeros}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
