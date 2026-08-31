import React, { useMemo, useState } from 'react';
import { Consulta } from '../types';
import { toISOInput, formatDateBR } from '../utils/date';
import { coerirAtendimento, validarConsulta, diasDeEspera, STATUS_CONSULTA, type ConsultaInput } from '../utils/consulta';
import { exportToXlsx } from '../utils/xlsxExporter';
import { dataISOLocal } from '../utils/date';
import { ClipboardList, Search, PlusCircle, Pencil, Trash2, CalendarCheck, Clock, X, Download } from 'lucide-react';

/**
 * Módulo "Consultas" — solicitação e atendimento por especialidade.
 *
 * Registro simples de fila, com os cinco campos pedidos e nada além:
 * funcionário, especialidade solicitada, data da solicitação, status
 * (No aguardo / Atendido) e data do atendimento. Funcionário e especialidade
 * são texto livre — não há catálogo de especialidades no sistema.
 */
interface ConsultasSectionProps {
  consultas: Consulta[];
  notify?: (msg: string, type?: 'error' | 'success' | 'info' | 'warning') => void;
  addConsulta: (c: ConsultaInput) => Promise<void>;
  updateConsulta: (id: string, campos: Partial<Consulta>) => Promise<void>;
  deleteConsulta: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  canManage?: boolean;
}

const STATUS_BADGE: Record<Consulta['status'], string> = {
  'No aguardo': 'bg-amber-50 text-amber-700 border-amber-200',
  'Atendido': 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const FORM_VAZIO: ConsultaInput = {
  funcionario: '',
  especialidade: '',
  dataSolicitacao: '',
  status: 'No aguardo',
  dataAtendimento: ''
};

const inputCls = 'w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-medium focus:border-slate-800';
const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';

const hoje = () => formatDateBR(new Date());

export const ConsultasSection: React.FC<ConsultasSectionProps> = ({
  consultas, addConsulta, updateConsulta, deleteConsulta, confirmAction, notify, canManage = true
}) => {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Consulta | null>(null);
  const [form, setForm] = useState<ConsultaInput>({ ...FORM_VAZIO });
  const [erros, setErros] = useState<string[]>([]);

  const set = (campo: keyof ConsultaInput, valor: string) =>
    setForm(f => coerirAtendimento({ ...f, [campo]: valor }));

  const filtradas = useMemo(() => consultas.filter(c => {
    const termo = busca.toLowerCase();
    const okBusca = !termo
      || c.funcionario.toLowerCase().includes(termo)
      || c.especialidade.toLowerCase().includes(termo);
    const okStatus = filtroStatus === 'TODOS' || c.status === filtroStatus;
    return okBusca && okStatus;
  }), [consultas, busca, filtroStatus]);

  const abrirNova = () => {
    setEditing(null);
    setErros([]);
    setForm({ ...FORM_VAZIO, dataSolicitacao: hoje() });
    setShowForm(true);
  };

  const abrirEdicao = (c: Consulta) => {
    setEditing(c);
    setErros([]);
    setForm({
      funcionario: c.funcionario,
      especialidade: c.especialidade,
      dataSolicitacao: c.dataSolicitacao,
      status: c.status,
      dataAtendimento: c.dataAtendimento || ''
    });
    setShowForm(true);
  };

  /** Atalho da tabela: abre a edição já marcada como Atendido, na data de hoje. */
  const abrirAtendimento = (c: Consulta) => {
    setEditing(c);
    setErros([]);
    setForm({
      funcionario: c.funcionario,
      especialidade: c.especialidade,
      dataSolicitacao: c.dataSolicitacao,
      status: 'Atendido',
      dataAtendimento: c.dataAtendimento || hoje()
    });
    setShowForm(true);
  };

  const salvar = async () => {
    const payload = coerirAtendimento({
      ...form,
      funcionario: form.funcionario.trim(),
      especialidade: form.especialidade.trim()
    });
    const problemas = validarConsulta(payload);
    setErros(problemas);
    if (problemas.length) return;

    if (editing) await updateConsulta(editing.id, payload);
    else await addConsulta(payload);
    setShowForm(false);
  };

  /** Exporta o que está na tela (lista filtrada), como nos demais módulos. */
  const exportar = async () => {
    if (!filtradas.length) { notify?.('Nada para exportar com os filtros atuais.', 'warning'); return; }
    const columns = [
      { title: 'Funcionário', width: 32 },
      { title: 'Especialidade solicitada', width: 28 },
      { title: 'Data da solicitação', width: 18 },
      { title: 'Status', width: 14 },
      { title: 'Data do atendimento', width: 18 },
      { title: 'Dias de espera', width: 14 },
    ];
    const rows = filtradas.map(c => [
      { type: String, value: c.funcionario },
      { type: String, value: c.especialidade },
      { type: String, value: c.dataSolicitacao || null },
      { type: String, value: c.status },
      { type: String, value: c.dataAtendimento || null },
      // Espera: até o atendimento, ou até hoje enquanto está na fila — é o
      // número que o RH quer ver na planilha e que a tabela não mostra.
      { type: Number, value: diasDeEspera(c) },
    ]);
    await exportToXlsx(`consultas_${dataISOLocal()}.xlsx`, columns, rows, { sheet: 'Consultas' });
  };

  const excluir = (c: Consulta) => {
    const acao = async () => { await deleteConsulta(c.id); };
    const mensagem = `Remover a consulta de "${c.funcionario}" (${c.especialidade})?`;
    if (confirmAction) confirmAction('Excluir consulta', mensagem, acao);
    else if (confirm(mensagem)) acao();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-500" />
            Consultas
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Especialidades solicitadas pelos funcionários e o andamento do atendimento.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={exportar}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
          {canManage && (
          <button
            onClick={abrirNova}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition"
          >
            <PlusCircle className="w-4 h-4" /> Nova consulta
          </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por funcionário ou especialidade…"
            aria-label="Buscar consulta"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          aria-label="Filtrar por status"
          className={inputCls}
        >
          <option value="TODOS">Todos os status</option>
          {STATUS_CONSULTA.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Funcionário</th>
                <th className="py-3.5 px-4">Especialidade solicitada</th>
                <th className="py-3.5 px-4">Solicitação</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Atendimento</th>
                {canManage && <th className="py-3.5 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="text-center py-12 text-slate-400 font-semibold">
                    {consultas.length === 0
                      ? <>Nenhuma consulta registrada. {canManage && 'Cadastre a primeira solicitação.'}</>
                      : <>Nenhuma consulta encontrada com os filtros atuais ({consultas.length} no total).</>}
                  </td>
                </tr>
              ) : filtradas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-4 font-bold text-slate-800">{c.funcionario}</td>
                  <td className="py-3 px-4 font-semibold">{c.especialidade}</td>
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums">{c.dataSolicitacao || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_BADGE[c.status]}`}>
                      {c.status === 'No aguardo' ? <Clock className="w-3 h-3" /> : <CalendarCheck className="w-3 h-3" />}
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums">{c.dataAtendimento || '—'}</td>
                  {canManage && (
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.status === 'No aguardo' && (
                          <button
                            onClick={() => abrirAtendimento(c)}
                            aria-label={`Marcar como atendida a consulta de ${c.funcionario}`}
                            className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" /> Atender
                          </button>
                        )}
                        <button
                          onClick={() => abrirEdicao(c)}
                          aria-label={`Editar a consulta de ${c.funcionario}`}
                          className="p-1.5 border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 rounded-lg transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => excluir(c)}
                          aria-label={`Excluir a consulta de ${c.funcionario}`}
                          className="p-1.5 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="consulta-modal-titulo"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          >
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 id="consulta-modal-titulo" className="text-sm font-bold text-slate-800">
                {editing ? 'Editar consulta' : 'Nova consulta'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Fechar formulário"
                className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
              <div className="col-span-2">
                <label htmlFor="cons-funcionario" className={labelCls}>Funcionário *</label>
                <input
                  id="cons-funcionario"
                  className={inputCls}
                  value={form.funcionario}
                  onChange={e => set('funcionario', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="cons-especialidade" className={labelCls}>Especialidade solicitada *</label>
                <input
                  id="cons-especialidade"
                  className={inputCls}
                  value={form.especialidade}
                  onChange={e => set('especialidade', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="cons-solicitacao" className={labelCls}>Data da solicitação *</label>
                <input
                  id="cons-solicitacao"
                  type="date"
                  className={`${inputCls} cursor-pointer`}
                  value={toISOInput(form.dataSolicitacao)}
                  onChange={e => set('dataSolicitacao', e.target.value ? formatDateBR(e.target.value) : '')}
                />
              </div>
              <div>
                <label htmlFor="cons-status" className={labelCls}>Status *</label>
                <select
                  id="cons-status"
                  className={`${inputCls} cursor-pointer`}
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  {STATUS_CONSULTA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="cons-atendimento" className={labelCls}>
                  Data do atendimento {form.status === 'Atendido' ? '*' : '(ao marcar como Atendido)'}
                </label>
                <input
                  id="cons-atendimento"
                  type="date"
                  disabled={form.status !== 'Atendido'}
                  className={`${inputCls} cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
                  value={toISOInput(form.dataAtendimento)}
                  onChange={e => set('dataAtendimento', e.target.value ? formatDateBR(e.target.value) : '')}
                />
              </div>

              <div className="col-span-2" role="alert" aria-live="polite">
                {erros.length > 0 && (
                  <ul className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold space-y-1">
                    {erros.map(erro => <li key={erro}>{erro}</li>)}
                  </ul>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-650 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold rounded-xl text-white shadow-md transition cursor-pointer"
              >
                {editing ? 'Salvar alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
