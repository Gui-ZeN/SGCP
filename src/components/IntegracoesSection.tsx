import React, { useMemo, useRef, useState } from 'react';
import { Integracao } from '../types';
import { Sede } from '../hooks/useMetadata';
import { parseIntegracoes, ImportableIntegracao } from '../lib/integracaoImport';
import { exportToXlsx } from '../utils/xlsxExporter';
import {
  GraduationCap, Search, PlusCircle, Pencil, Trash2, Upload, Download, ChevronDown,
  CheckCircle2, Clock, UserMinus, X, Loader2
} from 'lucide-react';

/**
 * Módulo "Integração" (treinamento de integração / onboarding) — EXCLUSIVO da
 * Universidade (a visibilidade é decidida no App: só Universidade + admin).
 */
interface IntegracoesSectionProps {
  integracoes: Integracao[];
  sedes: Sede[]; // só as sedes da Universidade (o App já filtra)
  addIntegracao: (i: ImportableIntegracao) => Promise<void>;
  updateIntegracao: (id: string, f: Partial<Integracao>) => Promise<void>;
  deleteIntegracao: (id: string) => Promise<void>;
  importIntegracoes: (list: ImportableIntegracao[]) => Promise<{ adicionadas: number; puladas: number }>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  notify?: (msg: string, type?: 'error' | 'success' | 'info' | 'warning') => void;
  canManage?: boolean;
  // Mudança rápida de status pela tabela (sem abrir o modal). Se ausente, usa updateIntegracao.
  onChangeStatus?: (id: string, status: Integracao['status']) => void;
}

const STATUS_BADGE: Record<Integracao['status'], string> = {
  'Realizado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Não realizado': 'bg-amber-50 text-amber-700 border-amber-200',
  'Desligado': 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_OPCOES: Integracao['status'][] = ['Realizado', 'Não realizado', 'Desligado'];

const FORM_VAZIO = { nome: '', funcao: '', setor: '', sede: '', admissao: '', supervisor: '', status: 'Não realizado' as Integracao['status'], dataIntegracao: '', responsavel: '', contato: '', observacao: '' };
const inputCls = 'w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800';
const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';

export const IntegracoesSection: React.FC<IntegracoesSectionProps> = ({
  integracoes, sedes, addIntegracao, updateIntegracao, deleteIntegracao, importIntegracoes,
  confirmAction, notify, canManage = true, onChangeStatus
}) => {
  // Mudança inline de status (leve): usa o handler dedicado se houver, senão o update comum.
  const mudarStatus = (i: Integracao, novo: Integracao['status']) => {
    if (novo === i.status) return;
    if (onChangeStatus) onChangeStatus(i.id, novo);
    else updateIntegracao(i.id, { status: novo });
  };
  const [busca, setBusca] = useState('');
  const [filtroSede, setFiltroSede] = useState('TODAS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Integracao | null>(null);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof FORM_VAZIO, v: string) => setForm(f => ({ ...f, [k]: v }));

  const filtradas = useMemo(() => integracoes.filter(i => {
    const t = busca.toLowerCase();
    const okBusca = !t || i.nome.toLowerCase().includes(t) || (i.funcao || '').toLowerCase().includes(t) || (i.supervisor || '').toLowerCase().includes(t);
    const okSede = filtroSede === 'TODAS' || i.sede === filtroSede;
    const okStatus = filtroStatus === 'TODOS' || i.status === filtroStatus;
    return okBusca && okSede && okStatus;
  }), [integracoes, busca, filtroSede, filtroStatus]);

  const kpi = useMemo(() => {
    const ativos = integracoes.filter(i => i.status !== 'Desligado');
    const realizados = integracoes.filter(i => i.status === 'Realizado').length;
    const pendentes = integracoes.filter(i => i.status === 'Não realizado').length;
    const taxa = ativos.length ? Math.round((realizados / ativos.length) * 100) : 0;
    return { total: integracoes.length, realizados, pendentes, taxa };
  }, [integracoes]);

  const abrirNovo = () => { setEditing(null); setForm({ ...FORM_VAZIO, sede: sedes[0]?.nome || '' }); setShowForm(true); };
  const abrirEdicao = (i: Integracao) => {
    setEditing(i);
    setForm({ nome: i.nome, funcao: i.funcao || '', setor: i.setor || '', sede: i.sede, admissao: i.admissao || '', supervisor: i.supervisor || '', status: i.status, dataIntegracao: i.dataIntegracao || '', responsavel: i.responsavel || '', contato: i.contato || '', observacao: i.observacao || '' });
    setShowForm(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.sede) { notify?.('Preencha pelo menos Nome e Campus.', 'warning'); return; }
    const payload = { ...form, nome: form.nome.trim() };
    if (editing) await updateIntegracao(editing.id, payload);
    else await addIntegracao(payload);
    setShowForm(false);
  };

  const excluir = (i: Integracao) => {
    const acao = async () => { await deleteIntegracao(i.id); };
    if (confirmAction) confirmAction('Excluir registro', `Remover a integração de "${i.nome}"?`, acao);
    else if (confirm(`Remover a integração de "${i.nome}"?`)) acao();
  };

  const importar = async (file: File) => {
    setImportando(true);
    try {
      const { integracoes: lidas, warnings } = await parseIntegracoes(file);
      if (!lidas.length) { notify?.('Nenhum registro reconhecido na planilha.', 'warning'); return; }
      const { adicionadas, puladas } = await importIntegracoes(lidas);
      notify?.(`Importação concluída: ${adicionadas} adicionada(s), ${puladas} duplicada(s) pulada(s).${warnings.length ? ` (${warnings.length} aviso(s) no console)` : ''}`, 'success');
      if (warnings.length) console.warn('Avisos do import de integrações:', warnings);
    } catch (e: any) {
      notify?.(`Erro ao importar: ${e?.message || e}`, 'error');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const exportar = async () => {
    if (!filtradas.length) { notify?.('Nada para exportar com os filtros atuais.', 'warning'); return; }
    const columns = [
      { title: 'Nome', width: 32 }, { title: 'Função', width: 24 }, { title: 'Setor', width: 16 },
      { title: 'Campus', width: 22 }, { title: 'Admissão', width: 12 }, { title: 'Supervisor', width: 20 },
      { title: 'Integração', width: 14 }, { title: 'Data', width: 16 }, { title: 'Responsável', width: 16 },
      { title: 'Contato', width: 16 }, { title: 'Observação', width: 30 }
    ];
    const rows = filtradas.map(i => [
      { type: String, value: i.nome }, { type: String, value: i.funcao || null }, { type: String, value: i.setor || null },
      { type: String, value: i.sede }, { type: String, value: i.admissao || null }, { type: String, value: i.supervisor || null },
      { type: String, value: i.status }, { type: String, value: i.dataIntegracao || null }, { type: String, value: i.responsavel || null },
      { type: String, value: i.contato || null }, { type: String, value: i.observacao || null }
    ]);
    await exportToXlsx(`integracoes_universidade_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, rows, { sheet: 'Integrações' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-orange-500" />
            Treinamento de Integração
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">Universidade</span>
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Onboarding dos novos colaboradores por campus.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportar} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition">
            <Download className="w-4 h-4" /> Exportar
          </button>
          {canManage && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" aria-label="Planilha de integração" onChange={e => { const f = e.target.files?.[0]; if (f) importar(f); }} />
              <button onClick={() => fileRef.current?.click()} disabled={importando} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition disabled:opacity-60">
                {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importar planilha
              </button>
              <button onClick={abrirNovo} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition">
                <PlusCircle className="w-4 h-4" /> Nova Integração
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Registros</span>
          <div className="text-2xl font-bold text-slate-800 mt-1">{kpi.total}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Realizadas</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{kpi.realizados}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> Pendentes</span>
          <div className="text-2xl font-bold text-amber-700 mt-1">{kpi.pendentes}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Taxa (ativos)</span>
          <div className="text-2xl font-bold text-slate-800 mt-1">{kpi.taxa}%</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, função ou supervisor…" className={`${inputCls} pl-9`} aria-label="Buscar integração" />
        </div>
        <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} className={inputCls} aria-label="Filtrar por campus">
          <option value="TODAS">Todos os campi</option>
          {sedes.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={inputCls} aria-label="Filtrar por status">
          <option value="TODOS">Todos os status</option>
          <option value="Realizado">Realizado</option>
          <option value="Não realizado">Não realizado</option>
          <option value="Desligado">Desligado</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Colaborador</th>
                <th className="py-3.5 px-4">Campus</th>
                <th className="py-3.5 px-4">Admissão</th>
                <th className="py-3.5 px-4">Integração</th>
                <th className="py-3.5 px-4">Data / Responsável</th>
                {canManage && <th className="py-3.5 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtradas.length === 0 ? (
                <tr><td colSpan={canManage ? 6 : 5} className="text-center py-12 text-slate-400 font-semibold">
                  Nenhum registro de integração. {canManage && 'Importe a planilha ou cadastre o primeiro.'}
                </td></tr>
              ) : filtradas.map(i => (
                <tr key={i.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{i.nome}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{[i.funcao, i.setor].filter(Boolean).join(' · ')}{i.supervisor ? ` · Sup.: ${i.supervisor}` : ''}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold whitespace-nowrap">{i.sede}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{i.admissao || '—'}</td>
                  <td className="py-3 px-4">
                    {canManage ? (
                      <div className="relative inline-block">
                        <select
                          value={i.status}
                          onChange={e => mudarStatus(i, e.target.value as Integracao['status'])}
                          aria-label={`Status da integração de ${i.nome}`}
                          className={`appearance-none cursor-pointer text-[9px] font-bold uppercase tracking-wider pl-2.5 pr-6 py-1 rounded-full border outline-none focus:ring-2 focus:ring-slate-800/10 ${STATUS_BADGE[i.status]}`}
                        >
                          {STATUS_OPCOES.map(s => <option key={s} value={s} className="bg-white text-slate-700 normal-case">{s}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                    ) : (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_BADGE[i.status]}`}>
                        {i.status === 'Desligado' && <UserMinus className="w-3 h-3 inline mr-1 -mt-0.5" />}{i.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div>{i.dataIntegracao || '—'}</div>
                    {i.responsavel && <div className="text-[11px] text-slate-400 font-medium">{i.responsavel}</div>}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => abrirEdicao(i)} aria-label={`Editar integração de ${i.nome}`} className="p-1.5 border border-slate-200 text-slate-500 hover:text-orange-600 hover:border-orange-300 rounded-lg transition cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => excluir(i)} aria-label={`Excluir integração de ${i.nome}`} className="p-1.5 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 rounded-lg transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de cadastro/edição */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{editing ? 'Editar integração' : 'Nova integração'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Fechar formulário" className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
              <div className="col-span-2"><label htmlFor="int-nome" className={labelCls}>Nome *</label><input id="int-nome" className={inputCls} value={form.nome} onChange={e => set('nome', e.target.value)} /></div>
              <div><label htmlFor="int-funcao" className={labelCls}>Função</label><input id="int-funcao" className={inputCls} value={form.funcao} onChange={e => set('funcao', e.target.value)} /></div>
              <div><label htmlFor="int-setor" className={labelCls}>Setor</label><input id="int-setor" className={inputCls} value={form.setor} onChange={e => set('setor', e.target.value)} /></div>
              <div><label htmlFor="int-sede" className={labelCls}>Campus *</label>
                <select id="int-sede" className={inputCls} value={form.sede} onChange={e => set('sede', e.target.value)}>
                  <option value="">Selecione…</option>
                  {sedes.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                </select>
              </div>
              <div><label htmlFor="int-admissao" className={labelCls}>Admissão (DD/MM/AAAA)</label><input id="int-admissao" className={inputCls} value={form.admissao} onChange={e => set('admissao', e.target.value)} placeholder="Ex.: 03/04/2026…" /></div>
              <div><label htmlFor="int-supervisor" className={labelCls}>Supervisor</label><input id="int-supervisor" className={inputCls} value={form.supervisor} onChange={e => set('supervisor', e.target.value)} /></div>
              <div><label htmlFor="int-status" className={labelCls}>Status</label>
                <select id="int-status" className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="Não realizado">Não realizado</option>
                  <option value="Realizado">Realizado</option>
                  <option value="Desligado">Desligado</option>
                </select>
              </div>
              <div><label htmlFor="int-data" className={labelCls}>Data da integração</label><input id="int-data" className={inputCls} value={form.dataIntegracao} onChange={e => set('dataIntegracao', e.target.value)} placeholder="Ex.: 19/08 às 14h…" /></div>
              <div><label htmlFor="int-resp" className={labelCls}>Responsável</label><input id="int-resp" className={inputCls} value={form.responsavel} onChange={e => set('responsavel', e.target.value)} /></div>
              <div><label htmlFor="int-contato" className={labelCls}>Contato</label><input id="int-contato" className={inputCls} value={form.contato} onChange={e => set('contato', e.target.value)} /></div>
              <div className="col-span-2"><label htmlFor="int-obs" className={labelCls}>Observação</label><textarea id="int-obs" rows={2} className={inputCls} value={form.observacao} onChange={e => set('observacao', e.target.value)} /></div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer">{editing ? 'Salvar alterações' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
