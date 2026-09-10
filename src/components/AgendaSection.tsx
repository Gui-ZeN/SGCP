import React, { useMemo, useState } from 'react';
import type { Selecao, Vaga, Integracao, Entrevista, Consulta, Experiencia } from '../types';
import { montarAgendaDoDia, resumoEmTexto, type TipoEvento } from '../utils/agenda';
import { formatDateBR, toISOInput, dataISOLocal } from '../utils/date';
import { validarAgendamento, validarConfirmacao, camposDaConfirmacao } from '../utils/selecao';
import {
  CalendarDays, ChevronLeft, ChevronRight, Users, Briefcase, CheckCircle2,
  GraduationCap, LogOut, ClipboardList, Clock, CalendarClock, PlusCircle, X
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
  /** Agendar e confirmar seleção. Ausentes = somente leitura (Visualizador). */
  agendarSelecao?: (dados: Omit<Selecao, 'id'>) => Promise<void>;
  confirmarSelecao?: (id: string, campos: Partial<Selecao>) => Promise<void>;
  sedes?: { nome: string; sigla?: string }[];
}

const ESTILO: Record<TipoEvento, { Icone: typeof Users; cor: string; rotulo: string }> = {
  'selecao':           { Icone: Users,        cor: 'bg-indigo-50 text-indigo-700 border-indigo-200', rotulo: 'Seleção' },
  'selecao-agendada':  { Icone: CalendarClock, cor: 'bg-amber-50 text-amber-700 border-amber-200',   rotulo: 'Agendada' },
  'integracao':        { Icone: GraduationCap, cor: 'bg-orange-50 text-orange-700 border-orange-200', rotulo: 'Integração' },
  'entrevista':        { Icone: LogOut,       cor: 'bg-rose-50 text-rose-700 border-rose-200',       rotulo: 'Desligamento' },
  'vaga-aberta':       { Icone: Briefcase,    cor: 'bg-sky-50 text-sky-700 border-sky-200',          rotulo: 'Vaga aberta' },
  'vaga-concluida':    { Icone: CheckCircle2, cor: 'bg-emerald-50 text-emerald-700 border-emerald-200', rotulo: 'Vaga concluída' },
  'consulta-aberta':   { Icone: ClipboardList, cor: 'bg-slate-100 text-slate-600 border-slate-200',  rotulo: 'Consulta' },
  'consulta-atendida': { Icone: ClipboardList, cor: 'bg-emerald-50 text-emerald-700 border-emerald-200', rotulo: 'Consulta atendida' },
  'experiencia-45':    { Icone: Clock,        cor: 'bg-amber-50 text-amber-700 border-amber-200',    rotulo: 'Prazo 45 dias' },
  'experiencia-90':    { Icone: Clock,        cor: 'bg-amber-50 text-amber-700 border-amber-200',    rotulo: 'Prazo 90 dias' },
};

const campoCls = 'w-full text-sm px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800';
const rotuloCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';

/** Soma dias a uma data ISO (YYYY-MM-DD) sem passar por fuso. */
function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const base = new Date(a, m - 1, d + dias);
  return dataISOLocal(base);
}

export const AgendaSection: React.FC<AgendaSectionProps> = (props) => {
  const { agendarSelecao, confirmarSelecao, sedes = [], ...fontes } = props;
  const [diaISO, setDiaISO] = useState(() => dataISOLocal());
  const hojeISO = dataISOLocal();

  // Agendamento
  const [abrindoAgenda, setAbrindoAgenda] = useState(false);
  const [form, setForm] = useState({ dataISO: '', cargo: '', sede: '', convocados: 0, responsavel: '', vagaId: '' });
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Confirmação de presença
  const [confirmando, setConfirmando] = useState<{ id: string; convocados: number; titulo: string } | null>(null);
  const [presentes, setPresentes] = useState(0);
  const [erroConfirmar, setErroConfirmar] = useState('');

  const dia = formatDateBR(diaISO);
  const { resumo, eventos } = useMemo(() => montarAgendaDoDia(dia, fontes), [dia, fontes]);

  const nomeDoDia = useMemo(() => {
    const [a, m, d] = diaISO.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
    });
  }, [diaISO]);

  /** Vagas em aberto, para agendar já vinculado — o que o histórico não tem. */
  const vagasAbertas = useMemo(
    () => fontes.vagas
      .filter(v => ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'].includes(v.status))
      .sort((a, b) => a.vaga.localeCompare(b.vaga, 'pt-BR')),
    [fontes.vagas]
  );

  const abrirAgendamento = () => {
    setForm({ dataISO: diaISO, cargo: '', sede: '', convocados: 0, responsavel: '', vagaId: '' });
    setErros([]);
    setAbrindoAgenda(true);
  };

  /** Escolher a vaga preenche cargo e sede — e grava o vínculo. */
  const escolherVaga = (vagaId: string) => {
    const v = vagasAbertas.find(x => x.id === vagaId);
    setForm(f => ({
      ...f,
      vagaId,
      cargo: v ? v.vaga : f.cargo,
      sede: v ? v.sede : f.sede,
    }));
  };

  const salvarAgendamento = async () => {
    const data = formatDateBR(form.dataISO);
    const problemas = validarAgendamento({ data, cargo: form.cargo, sede: form.sede, convocados: form.convocados });
    setErros(problemas);
    if (problemas.length || !agendarSelecao) return;

    const vaga = vagasAbertas.find(v => v.id === form.vagaId);
    setSalvando(true);
    try {
      await agendarSelecao({
        data,
        cargo: form.cargo.trim(),
        sede: form.sede.trim(),
        responsavel: form.responsavel.trim(),
        origem: 'geral',
        status: 'agendado',
        convocados: form.convocados,
        compareceram: 0,
        ausentes: 0,
        contratados: 0,
        desistiram: 0,
        ...(vaga ? { vagaId: vaga.id, vagaCodigo: vaga.codigo } : {}),
      });
      setAbrindoAgenda(false);
    } catch (e: any) {
      setErros([`Não foi possível agendar: ${e?.message || e}`]);
    } finally {
      setSalvando(false);
    }
  };

  const salvarConfirmacao = async () => {
    if (!confirmando || !confirmarSelecao) return;
    const problemas = validarConfirmacao(confirmando.convocados, presentes);
    setErroConfirmar(problemas[0] || '');
    if (problemas.length) return;

    setSalvando(true);
    try {
      await confirmarSelecao(confirmando.id, camposDaConfirmacao(confirmando.convocados, presentes));
      setConfirmando(null);
    } catch (e: any) {
      setErroConfirmar(`Não foi possível confirmar: ${e?.message || e}`);
    } finally {
      setSalvando(false);
    }
  };

  const cards = [
    { n: resumo.convocados, t: 'Convocados', cor: 'text-slate-800' },
    { n: resumo.compareceram, t: 'Compareceram', cor: 'text-emerald-600' },
    { n: resumo.vagasAbertas, t: 'Vagas abertas', cor: 'text-sky-600' },
    { n: resumo.vagasConcluidas, t: 'Vagas concluídas', cor: 'text-emerald-600' },
    { n: resumo.integracoes, t: 'Integrações', cor: 'text-orange-600' },
    { n: resumo.aConfirmar, t: 'A confirmar', cor: 'text-amber-600' },
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
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition"
            >
              Hoje
            </button>
          )}
          {agendarSelecao && (
            <button
              onClick={abrirAgendamento}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition"
            >
              <PlusCircle className="w-4 h-4" /> Agendar seleção
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
              <div className="text-right shrink-0 flex items-center gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{rotulo}</span>
                  {evento.numeros && (
                    <p className="text-[11px] font-bold text-slate-600 tabular-nums">{evento.numeros}</p>
                  )}
                </div>
                {evento.tipo === 'selecao-agendada' && confirmarSelecao && evento.selecaoId && (
                  <button
                    onClick={() => {
                      setConfirmando({ id: evento.selecaoId!, convocados: evento.convocados || 0, titulo: evento.titulo });
                      setPresentes(evento.convocados || 0);
                      setErroConfirmar('');
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition shrink-0"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agendar seleção */}
      {abrindoAgenda && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="ag-titulo"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 id="ag-titulo" className="text-sm font-bold text-slate-800">Agendar seleção</h3>
              <button onClick={() => setAbrindoAgenda(false)} aria-label="Fechar"
                className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label htmlFor="ag-vaga" className={rotuloCls}>Vaga (opcional)</label>
                <select id="ag-vaga" className={campoCls} value={form.vagaId} onChange={e => escolherVaga(e.target.value)}>
                  <option value="">Sem vaga específica</option>
                  {vagasAbertas.map(v => (
                    <option key={v.id} value={v.id}>#{v.codigo} — {v.vaga} · {v.sede}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  Escolher a vaga preenche cargo e sede — e liga a seleção a ela.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ag-data" className={rotuloCls}>Data *</label>
                  <input id="ag-data" type="date" className={`${campoCls} cursor-pointer`}
                    value={form.dataISO} onChange={e => setForm(f => ({ ...f, dataISO: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="ag-convocados" className={rotuloCls}>Convocados *</label>
                  <input id="ag-convocados" type="number" min={1} className={campoCls}
                    value={form.convocados || ''} onChange={e => setForm(f => ({ ...f, convocados: Number(e.target.value) }))} />
                </div>
              </div>

              <div>
                <label htmlFor="ag-cargo" className={rotuloCls}>Cargo *</label>
                <input id="ag-cargo" className={campoCls} placeholder="Ex.: Professor(a)…"
                  value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ag-sede" className={rotuloCls}>Sede *</label>
                  {sedes.length > 0 ? (
                    <select id="ag-sede" className={campoCls} value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))}>
                      <option value="">Selecione…</option>
                      {sedes.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
                    </select>
                  ) : (
                    <input id="ag-sede" className={campoCls} value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))} />
                  )}
                </div>
                <div>
                  <label htmlFor="ag-responsavel" className={rotuloCls}>Responsável (RH)</label>
                  <input id="ag-responsavel" className={campoCls}
                    value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
                </div>
              </div>

              {erros.length > 0 && (
                <ul role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold space-y-1">
                  {erros.map(e => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setAbrindoAgenda(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 cursor-pointer">
                Cancelar
              </button>
              <button onClick={salvarAgendamento} disabled={salvando}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md cursor-pointer disabled:opacity-60">
                {salvando ? 'Agendando…' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar presença */}
      {confirmando && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="cf-titulo"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-50 border-b border-slate-100">
              <h3 id="cf-titulo" className="text-sm font-bold text-slate-800">Confirmar presença</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{confirmando.titulo}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="cf-presentes" className={rotuloCls}>
                  Quantos compareceram? (de {confirmando.convocados} convocados)
                </label>
                <input id="cf-presentes" type="number" min={0} max={confirmando.convocados} className={campoCls}
                  value={presentes} onChange={e => setPresentes(Number(e.target.value))} />
                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  Ausentes: <strong>{Math.max(0, confirmando.convocados - presentes)}</strong> — calculado, não digitado.
                </p>
              </div>

              {erroConfirmar && (
                <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold">
                  {erroConfirmar}
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setConfirmando(null)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 cursor-pointer">
                Cancelar
              </button>
              <button onClick={salvarConfirmacao} disabled={salvando}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md cursor-pointer disabled:opacity-60">
                {salvando ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
