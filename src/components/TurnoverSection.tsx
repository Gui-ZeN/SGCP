/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Turnover } from '../types';
import { 
  Percent, 
  PlusCircle, 
  Calculator, 
  Trash2, 
  Pencil,
  TrendingUp, 
  Users, 
  UserPlus, 
  UserMinus,
  Calendar
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  BarChart, 
  Bar 
} from 'recharts';

interface TurnoverSectionProps {
  turnover: Turnover[];
  addTurnover: (input: Omit<Turnover, 'id'>) => Promise<void>;
  updateTurnover: (id: string, updatedFields: Partial<Turnover>) => Promise<void>;
  deleteTurnover: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  canManage?: boolean;
}

export const TurnoverSection: React.FC<TurnoverSectionProps> = ({
  turnover,
  addTurnover,
  updateTurnover,
  deleteTurnover,
  confirmAction,
  canManage = true
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTurnover, setEditingTurnover] = useState<Turnover | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [mesAno, setMesAno] = useState('');
  const [totalFuncionarios, setTotalFuncionarios] = useState<number>(150);
  const [totalAdmissao, setTotalAdmissao] = useState<number>(5);
  const [pediramSair, setPediramSair] = useState<number>(2);
  const [foramDesligados, setForamDesligados] = useState<number>(2);

  const mesAnoToInput = (value: string) => {
    const parts = value.split('/');
    if (parts.length === 2) return `${parts[1]}-${parts[0].padStart(2, '0')}`;
    return value;
  };

  const resetForm = () => {
    setMesAno('');
    setTotalFuncionarios(150);
    setTotalAdmissao(5);
    setPediramSair(2);
    setForamDesligados(2);
    setEditingTurnover(null);
    setErrorMsg('');
  };

  const openCreateForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (item: Turnover) => {
    setEditingTurnover(item);
    setMesAno(mesAnoToInput(item.mesAno || ''));
    setTotalFuncionarios(item.totalFuncionarios || 0);
    setTotalAdmissao(item.totalAdmissao || 0);
    setPediramSair(item.pediramSair || 0);
    setForamDesligados(item.foramDesligados || 0);
    setErrorMsg('');
    setShowAddForm(true);
  };

  // Auto computations mapping for chart visualization
  const computedData = useMemo(() => {
    return turnover.map((item) => {
      const saidasTotais = (item.pediramSair || 0) + (item.foramDesligados || 0);
      
      // Formulas
      const turnoverTotal = item.totalFuncionarios > 0 
        ? (((item.totalAdmissao + saidasTotais) / 2) / item.totalFuncionarios) * 100 
        : 0;

      const turnoverVoluntario = item.totalFuncionarios > 0
        ? ((item.pediramSair || 0) / item.totalFuncionarios) * 100
        : 0;

      const turnoverInvoluntario = item.totalFuncionarios > 0
        ? ((item.foramDesligados || 0) / item.totalFuncionarios) * 100
        : 0;

      return {
        ...item,
        saidasTotais,
        turnoverTotal: Number(turnoverTotal.toFixed(2)),
        turnoverVoluntario: Number(turnoverVoluntario.toFixed(2)),
        turnoverInvoluntario: Number(turnoverInvoluntario.toFixed(2))
      };
    });
  }, [turnover]);

  // General Average KPI
  const avgStats = useMemo(() => {
    if (computedData.length === 0) return { total: '0.0', voluntario: '0.0', involuntario: '0.0' };
    
    const sumTotal = computedData.reduce((acc, curr) => acc + curr.turnoverTotal, 0);
    const sumVol = computedData.reduce((acc, curr) => acc + curr.turnoverVoluntario, 0);
    const sumInvol = computedData.reduce((acc, curr) => acc + curr.turnoverInvoluntario, 0);
    
    return {
      total: (sumTotal / computedData.length).toFixed(1),
      voluntario: (sumVol / computedData.length).toFixed(1),
      involuntario: (sumInvol / computedData.length).toFixed(1)
    };
  }, [computedData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!mesAno.trim()) {
      setErrorMsg("Por favor, preencha o Mês/Ano.");
      return;
    }

    // Convert monthly select value from YYYY-MM to MM/YYYY
    let cleanMesAno = mesAno;
    if (mesAno.includes('-')) {
      const parts = mesAno.split('-');
      cleanMesAno = `${parts[1]}/${parts[0]}`;
    }

    const payload = {
      mesAno: cleanMesAno,
      totalFuncionarios: Number(totalFuncionarios) || 0,
      totalAdmissao: Number(totalAdmissao) || 0,
      pediramSair: Number(pediramSair) || 0,
      foramDesligados: Number(foramDesligados) || 0
    };

    try {
      if (editingTurnover) {
        await updateTurnover(editingTurnover.id, payload);
      } else {
        await addTurnover(payload);
      }
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg('Erro ao salvar. Verifique a conexão e tente novamente.' + (err?.message ? ` (${err.message})` : ''));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <Percent className="w-6 h-6 text-orange-500" />
            Índice de Rotatividade (Turnover)
          </h2>
          <p className="text-slate-500 text-sm font-medium font-sans">Acompanhe estatísticas mensais de admissão, demissão espontânea e demissão induzida.</p>
        </div>
        {canManage && (
        <button
          onClick={openCreateForm}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          Logar Mês Operacional
        </button>
        )}
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Turnover Avg */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-350 tracking-wider flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-orange-400" />
              Turnover Médio Total
            </span>
            <div className="text-2xl font-bold mt-2">{avgStats.total}%</div>
            <p className="text-[9px] text-slate-400 font-medium mt-1">Fórmula padrão: Admissão + Saída sênior</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-orange-400" />
          </div>
        </div>

        {/* Voluntario Avg */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Turnover Voluntário Médio</span>
            <div className="text-xl font-bold text-slate-800 mt-2">{avgStats.voluntario}%</div>
            <p className="text-[9px] text-slate-400 font-medium mt-1">Colaboradores solicitantes (pediram saída)</p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <UserMinus className="w-5 h-5" />
          </div>
        </div>

        {/* Involuntario Avg */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Turnover Involuntário Médio</span>
            <div className="text-xl font-bold text-slate-800 mt-2">{avgStats.involuntario}%</div>
            <p className="text-[9px] text-slate-400 font-medium mt-1">Desligamentos iniciados pelo empregador</p>
          </div>
          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center">
            <UserMinus className="w-5 h-5 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Chart Visualizer */}
      {computedData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Timeline chart */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Comportamento Geral das Rotatividades (%)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={computedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="mesAno" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 600 }} />
                  <Tooltip wrapperStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Area type="monotone" name="Turnover Total (%)" dataKey="turnoverTotal" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" />
                  <Area type="monotone" name="Voluntário (%)" dataKey="turnoverVoluntario" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVol)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hiring vs Dismissal flow */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Fluxo de Movimentação do Quadro (Admissão vs Demissão)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={computedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="mesAno" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 600 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Bar name="Admissões" dataKey="totalAdmissao" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar name="Saídas (Desligamentos)" dataKey="saidasTotais" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Monthly data list */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-in fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-5">Período / Efetivo</th>
                <th className="py-4 px-5">Movimentação (Entradas / Saídas)</th>
                <th className="py-4 px-5">Taxas de Turnover (%)</th>
                <th className="py-4 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-sm text-slate-700">
              {computedData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400 font-semibold">
                    Sem registros operacionais de turnover cadastrados.
                  </td>
                </tr>
              ) : (
                computedData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-3 px-5">
                      <div className="font-bold text-slate-850 flex items-center gap-1.5 whitespace-nowrap mb-0.5">
                        <Calendar className="w-4 h-4 text-slate-450" />
                        {item.mesAno}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 ml-5">
                        Efetivo: {item.totalFuncionarios} colaboradores
                      </div>
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-3 text-xs font-mono">
                         <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1"><span className="text-[9px] uppercase font-sans text-emerald-800">In:</span> +{item.totalAdmissao}</span>
                         <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1"><span className="text-[9px] uppercase font-sans text-blue-800">Vol:</span> -{item.pediramSair}</span>
                         <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex items-center gap-1"><span className="text-[9px] uppercase font-sans text-rose-800">Invol:</span> -{item.foramDesligados}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                       <div className="flex items-center gap-3">
                          <div className="font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg text-sm font-mono">
                            {item.turnoverTotal}%
                          </div>
                          <div className="flex flex-col gap-0.5 text-[10px] uppercase font-bold tracking-wider">
                            <span className="text-blue-600">Voluntário: <span className="font-mono text-xs">{item.turnoverVoluntario}%</span></span>
                            <span className="text-rose-600">Involuntário: <span className="font-mono text-xs">{item.turnoverInvoluntario}%</span></span>
                          </div>
                       </div>
                    </td>
                    <td className="py-3 px-5 text-right">
                      {canManage ? (
                        <>
                      <button
                        onClick={() => openEditForm(item)}
                        className="p-1 px-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-lg cursor-pointer transition border border-transparent hover:border-slate-200 mr-1"
                        title="Editar registro"
                      >
                         <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmAction) {
                            confirmAction(
                              "Remover Indicadores de Turnover",
                              `Deseja realmente remover permanentemente a planilha de headcount e logs do mês ${item.mesAno}? Isto resetará as médias estatísticas exibidas no dashboard.`,
                              () => deleteTurnover(item.id)
                            );
                          } else {
                            if (confirm(`Remover permanentemente os logs do mês ${item.mesAno}?`)) {
                              deleteTurnover(item.id);
                            }
                          }
                        }}
                        className="p-1 px-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg cursor-pointer transition border border-transparent hover:border-rose-100"
                        title="Deletar registro"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leitura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation form dialog */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/65 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold">{editingTurnover ? 'Editar Quadro de Turnover Mensal' : 'Registrar Quadro de Turnover Mensal'}</h3>
              </div>
              <button 
                onClick={() => { resetForm(); setShowAddForm(false); }} 
                className="text-slate-400 hover:text-white font-bold text-2xl cursor-pointer leading-none"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-700 font-bold shrink-0">!</span>
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mês de Referência (Mês/Ano) *</label>
                <input
                  type="month"
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  value={mesAno}
                  onChange={(e) => setMesAno(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total Ativo de Funcionários (Último dia do Mês)</label>
                <input
                  type="number"
                  placeholder="Ex: 154"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl font-mono text-slate-800"
                  value={totalFuncionarios}
                  onChange={(e) => setTotalFuncionarios(Number(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border rounded-2xl">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Admissões</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 text-xs bg-white border rounded font-mono"
                    value={totalAdmissao}
                    onChange={(e) => setTotalAdmissao(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Espontâneas</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 text-xs bg-white border rounded font-mono"
                    value={pediramSair}
                    onChange={(e) => setPediramSair(Number(e.target.value))}
                    title="Funcionários que pediram desligamento voluntário"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Demissões</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 text-xs bg-white border rounded font-mono"
                    value={foramDesligados}
                    onChange={(e) => setForamDesligados(Number(e.target.value))}
                    title="Funcionários desligados de forma involuntária"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowAddForm(false); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-sm font-bold rounded-xl text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-sm font-bold rounded-xl text-white shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  {editingTurnover ? 'Atualizar Índices' : 'Registar Índices'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
