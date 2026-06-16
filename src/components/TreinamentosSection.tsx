/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Treinamento } from '../types';
import { toISOInput } from '../utils/date';
import { exportToXlsx } from '../utils/xlsxExporter';
import { 
  GraduationCap, 
  Search, 
  MapPin, 
  DollarSign, 
  Clock, 
  Users, 
  PlusCircle, 
  Calendar,
  X,
  FileSpreadsheet,
  Trash2,
  Pencil
} from 'lucide-react';
import { Sede } from '../hooks/useMetadata';

interface TreinamentosSectionProps {
  treinamentos: Treinamento[];
  addTreinamento: (input: Omit<Treinamento, 'id' | 'codigo'>) => Promise<void>;
  updateTreinamento: (id: string, updatedFields: Partial<Treinamento>) => Promise<void>;
  deleteTreinamento: (id: string) => Promise<void>;
  sedes?: Sede[];
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  userSede?: string;
  isAdmin?: boolean;
  canManage?: boolean;
}

export const TreinamentosSection: React.FC<TreinamentosSectionProps> = ({ 
  treinamentos, 
  addTreinamento, 
  updateTreinamento,
  deleteTreinamento,
  sedes,
  confirmAction,
  userSede,
  isAdmin = false,
  canManage = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnidade, setSelectedUnidade] = useState(() => {
    return !isAdmin && userSede ? userSede : '';
  });
  const [selectedTipo, setSelectedTipo] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTreinamento, setEditingTreinamento] = useState<Treinamento | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (!isAdmin && userSede) {
      setSelectedUnidade(userSede);
    }
  }, [userSede, isAdmin]);

  // New Training form state
  const [tema, setTema] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataTermino, setDataTermino] = useState('');
  const [tipo, setTipo] = useState<Treinamento['tipo']>('Técnico');
  const [facilitador, setFacilitador] = useState('');
  const [publico, setPublico] = useState('');
  const [unidade, setUnidade] = useState('DT');
  const [cargaHoraria, setCargaHoraria] = useState<number>(8);
  const [qtdPrevista, setQtdPrevista] = useState<number>(10);
  const [qtdRealizada, setQtdRealizada] = useState<number>(10);
  const [valorInvestido, setValorInvestido] = useState<number>(500);
  const [mesReferenciaOverride, setMesReferenciaOverride] = useState<string>('');

  // Auto-calculate suggested ref month for display
  const [autoRefMonth, setAutoRefMonth] = useState('geral');
  
  useEffect(() => {
    if (dataInicio) {
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      try {
        let parts = dataInicio.split('-');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            setAutoRefMonth(months[mIdx]);
            return;
          }
        }
        parts = dataInicio.split('/');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            setAutoRefMonth(months[mIdx]);
            return;
          }
        }
      } catch (err) {}
    }
    setAutoRefMonth('geral');
  }, [dataInicio]);
  
  // Options
  const unidadesList = useMemo(() => {
    const list = sedes ? sedes.map(s => s.nome) : treinamentos.map(t => t.unidade).filter(Boolean);
    return Array.from(new Set(list as string[])).filter(Boolean).sort((a,b) => a.localeCompare(b));
  }, [treinamentos, sedes]);

  const tiposList: Treinamento['tipo'][] = ['Liderança', 'Integração', 'Técnico', 'Operacional', 'Comportamental'].sort((a,b) => a.localeCompare(b)) as Treinamento['tipo'][];

  const dateToInput = (value?: string) => toISOInput(value);

  const resetForm = () => {
    setTema('');
    setDataInicio('');
    setDataTermino('');
    setTipo('Técnico');
    setFacilitador('');
    setPublico('');
    setUnidade(userSede || 'DT');
    setCargaHoraria(8);
    setQtdPrevista(10);
    setQtdRealizada(10);
    setValorInvestido(500);
    setMesReferenciaOverride('');
    setEditingTreinamento(null);
    setErrorMsg('');
  };

  const openCreateForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (treinamento: Treinamento) => {
    setEditingTreinamento(treinamento);
    setTema(treinamento.tema || '');
    setDataInicio(dateToInput(treinamento.dataInicio));
    setDataTermino(dateToInput(treinamento.dataTermino));
    setTipo(treinamento.tipo || 'Técnico');
    setFacilitador(treinamento.facilitador || '');
    setPublico(treinamento.publico || '');
    setUnidade(treinamento.unidade || userSede || 'DT');
    setCargaHoraria(treinamento.cargaHoraria || 0);
    setQtdPrevista(treinamento.qtdPrevista || 0);
    setQtdRealizada(treinamento.qtdRealizada || 0);
    setValorInvestido(treinamento.valorInvestido || 0);
    setMesReferenciaOverride(treinamento.mesReferencia || '');
    setErrorMsg('');
    setShowAddForm(true);
  };

  // Filters
  const filteredList = useMemo(() => {
    return treinamentos.filter(t => {
      const matchText = !searchTerm.trim() || 
        t.tema.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.facilitador.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.publico.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchUnidade = !selectedUnidade || (t.unidade && t.unidade.toLowerCase() === selectedUnidade.toLowerCase());
      const matchTipo = !selectedTipo || t.tipo === selectedTipo;

      return matchText && matchUnidade && matchTipo;
    });
  }, [treinamentos, searchTerm, selectedUnidade, selectedTipo, userSede, isAdmin]);

  // Stats
  const stats = useMemo(() => {
    let totalInvestido = 0;
    let totalHorasFormacao = 0;
    let totalCarga = 0;
    let totalPrevisto = 0;
    let totalRealizado = 0;

    filteredList.forEach(t => {
      totalInvestido += (t.valorInvestido || 0);
      totalHorasFormacao += (t.totalHorasFormacao || ((t.qtdRealizada || 0) * (t.cargaHoraria || 0)));
      totalCarga += (t.cargaHoraria || 0);
      totalPrevisto += (t.qtdPrevista || 0);
      totalRealizado += (t.qtdRealizada || 0);
    });

    return {
      totalInvestido,
      totalHorasFormacao,
      totalCarga,
      presencaMedia: totalPrevisto > 0 ? Math.round((totalRealizado / totalPrevisto) * 100) : 100,
      totalQualificados: totalRealizado
    };
  }, [filteredList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!tema.trim() || !facilitador.trim() || !dataInicio.trim()) {
      setErrorMsg("Por favor, preencha Tema, Facilitador e Data de Início.");
      return;
    }

    // Reference month computation (Portuguese e.g. "maio")
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    let refMonth = 'geral';
    
    // Format YYYY-MM-DD to DD/MM/YYYY if needed, and detect month
    let finalDataInicio = dataInicio;
    let finalDataTermino = dataTermino;
    
    try {
      let parts = dataInicio.split('-');
      if (parts.length === 3) {
        finalDataInicio = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          refMonth = months[mIdx];
        }
      } else {
        parts = dataInicio.split('/');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            refMonth = months[mIdx];
          }
        }
      }
      
      if (dataTermino) {
        const partsTerm = dataTermino.split('-');
        if (partsTerm.length === 3) {
          finalDataTermino = `${partsTerm[2]}/${partsTerm[1]}/${partsTerm[0]}`;
        }
      }
    } catch(err){}

    const totalCalculatedHours = Number(qtdRealizada) * Number(cargaHoraria);

    const payload = {
      dataInicio: finalDataInicio,
      dataTermino: finalDataTermino || undefined,
      mesReferencia: mesReferenciaOverride || refMonth,
      tema,
      tipo,
      facilitador,
      publico,
      unidade,
      cargaHoraria: Number(cargaHoraria) || 0,
      qtdPrevista: Number(qtdPrevista) || 0,
      qtdRealizada: Number(qtdRealizada) || 0,
      totalHorasFormacao: totalCalculatedHours,
      valorInvestido: Number(valorInvestido) || 0
    };

    try {
      if (editingTreinamento) {
        await updateTreinamento(editingTreinamento.id, payload);
      } else {
        await addTreinamento(payload);
      }
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg('Erro ao salvar. Verifique a conexão e tente novamente.' + (err?.message ? ` (${err.message})` : ''));
    }
  };

  const handleExportTreinamentos = async () => {
    if (!filteredList.length) { alert('Nenhum treinamento para exportar.'); return; }
    const columns = [
      { title: 'Código', width: 10 },
      { title: 'Tema', width: 34 },
      { title: 'Tipo', width: 16 },
      { title: 'Data Início', width: 14 },
      { title: 'Data Término', width: 14 },
      { title: 'Mês Referência', width: 16 },
      { title: 'Facilitador', width: 24 },
      { title: 'Público', width: 22 },
      { title: 'Unidade', width: 16 },
      { title: 'Carga Horária', width: 14 },
      { title: 'Qtd Prevista', width: 14 },
      { title: 'Qtd Realizada', width: 14 },
      { title: 'Horas Formação', width: 16 },
      { title: 'Valor Investido (R$)', width: 18 }
    ];
    const rows = filteredList.map(t => [
      { type: Number, value: t.codigo ?? null },
      { type: String, value: t.tema || null },
      { type: String, value: t.tipo || null },
      { type: String, value: t.dataInicio || null },
      { type: String, value: t.dataTermino || null },
      { type: String, value: t.mesReferencia || null },
      { type: String, value: t.facilitador || null },
      { type: String, value: t.publico || null },
      { type: String, value: t.unidade || null },
      { type: Number, value: t.cargaHoraria ?? null },
      { type: Number, value: t.qtdPrevista ?? null },
      { type: Number, value: t.qtdRealizada ?? null },
      { type: Number, value: t.totalHorasFormacao ?? null },
      { type: Number, value: t.valorInvestido ?? null }
    ]);
    try {
      await exportToXlsx(`relatorio_treinamentos_${new Date().toISOString().slice(0, 10)}.xlsx`, columns, rows, { sheet: 'Treinamentos' });
    } catch (err) {
      console.error('Erro ao exportar XLSX:', err);
      alert('Não foi possível gerar o arquivo Excel. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-orange-500" />
            Desenvolvimento & Treinamento
          </h2>
          <p className="text-slate-500 text-sm font-medium">Controle de capacitações, horas de formação e investimentos corporativos.</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={handleExportTreinamentos}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-750 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-250 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Baixar planilha Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Exportar Excel
          </button>
          {canManage && (
            <button
              id="btn-show-add-treinamento"
              onClick={openCreateForm}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Registrar Treinamento
            </button>
          )}
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Investimento Total</div>
            <div className="text-md font-bold text-slate-800">
              {stats.totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Horas de Formação</div>
            <div className="text-md font-bold text-slate-800">{stats.totalHorasFormacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} hrs</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Colaboradores Qualificados</div>
            <div className="text-md font-bold text-slate-800">{stats.totalQualificados} concluintes</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Aproveitamento / Presença</div>
            <div className="text-md font-bold text-slate-800">{stats.presencaMedia}%</div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Desk */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500"
            placeholder="Pesquisar por Tema, Facilitador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
          value={selectedUnidade}
          onChange={(e) => setSelectedUnidade(e.target.value)}
        >
          <option value="">Todas as Unidades</option>
          {unidadesList.map((u, i) => (
            <option key={i} value={u}>{u}</option>
          ))}
        </select>

        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500"
          value={selectedTipo}
          onChange={(e) => setSelectedTipo(e.target.value)}
        >
          <option value="">Todos os Tipos de Conteúdo</option>
          {tiposList.map((t, i) => (
            <option key={i} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Training Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredList.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium shadow-sm">
            Nenhum treinamento registrado com esses termos.
          </div>
        ) : (
          filteredList.map((t) => {
            const presencaPct = t.qtdPrevista > 0 ? Math.round((t.qtdRealizada / t.qtdPrevista) * 100) : 100;
            return (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden relative group">
                <div className={`h-2 w-full ${
                  t.tipo === 'Liderança' ? 'bg-orange-500' :
                  t.tipo === 'Integração' ? 'bg-emerald-500' :
                  t.tipo === 'Técnico' ? 'bg-blue-500' :
                  'bg-slate-400'
                }`}></div>
                
                <div className="p-5 flex-1 flex flex-col">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="pr-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-widest">
                        Cód: #{t.codigo || 'S/N'}
                      </span>
                      <h3 className="font-bold text-slate-850 mt-1 leading-snug">{t.tema}</h3>
                    </div>
                    <span className={`shrink-0 inline-block px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-lg border ${
                      t.tipo === 'Liderança' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      t.tipo === 'Integração' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      t.tipo === 'Técnico' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {t.tipo}
                    </span>
                  </div>

                  {/* Info flex items */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.dataInicio} {t.dataTermino ? `— ${t.dataTermino}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.unidade}</span>
                    </div>
                  </div>

                  {/* Facilitador & Publico */}
                  <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Facilitador</span>
                      <p className="text-xs font-semibold text-slate-800 truncate" title={t.facilitador}>{t.facilitador}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Público Alvo</span>
                      <p className="text-xs font-semibold text-slate-800 truncate" title={t.publico}>{t.publico}</p>
                    </div>
                  </div>

                  <div className="mt-auto">
                    {/* Numbers / Progress */}
                    <div className="flex items-end justify-between mb-1.5">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Participação</span>
                        <div className="text-sm font-extrabold text-slate-800">
                          {t.qtdRealizada} <span className="text-xs font-medium text-slate-400">/ {t.qtdPrevista}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Aproveitamento</span>
                        <div className={`text-sm font-black ${presencaPct >= 90 ? 'text-emerald-600' : presencaPct >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {presencaPct}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-4">
                      <div 
                        className={`h-full rounded-full ${presencaPct >= 90 ? 'bg-emerald-500' : presencaPct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(presencaPct, 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Carga</span>
                        <span className="text-xs font-bold text-slate-700">{t.cargaHoraria}h / {(t.totalHorasFormacao || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h Total</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Custo (<span className="capitalize">{t.mesReferencia}</span>)</span>
                        <span className="text-[13px] font-mono font-bold text-slate-800">
                          {t.valorInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <>
                <button
                  onClick={() => openEditForm(t)}
                  className="absolute top-4 right-14 p-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-xl cursor-pointer transition-all shadow-sm z-10"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {/* Delete button (displays clearly for explicit manual cleanups) */}
                <button
                  onClick={() => {
                    if (confirmAction) {
                      confirmAction(
                        "Excluir Treinamento",
                        `Remover "${t.tema}"? Esta ação removerá os dados dos indicadores globais.`,
                        () => deleteTreinamento(t.id)
                      );
                    } else {
                      if (confirm(`Remover permanentemente "${t.tema}"?`)) {
                        deleteTreinamento(t.id);
                      }
                    }
                  }}
                  className="absolute top-4 right-4 p-1.5 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-xl cursor-pointer transition-all shadow-sm z-10"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* PopUp Creation Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/65 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold">{editingTreinamento ? 'Editar Treinamento' : 'Registrar Novo Treinamento'}</h3>
              </div>
              <button 
                onClick={() => { resetForm(); setShowAddForm(false); }} 
                className="text-slate-400 hover:text-white font-bold text-2xl cursor-pointer leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-700 font-bold shrink-0">!</span>
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tema da Qualificação *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Treinamento LNT e Processo de Promoções"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl font-medium"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início *</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      className="w-full pl-8 pr-2 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl cursor-pointer"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                    <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Término</label>
                  <div className="relative">
                    <input
                      type="date"
                      className="w-full pl-8 pr-2 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl cursor-pointer"
                      value={dataTermino}
                      onChange={(e) => setDataTermino(e.target.value)}
                    />
                    <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mês Ref. (Opcional)</label>
                  <input
                    type="text"
                    placeholder={`Auto (${autoRefMonth})`}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl capitalize placeholder:lowercase"
                    value={mesReferenciaOverride}
                    onChange={(e) => setMesReferenciaOverride(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Conteúdo</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as Treinamento['tipo'])}
                  >
                    {tiposList.map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Facilitador / Palestrante *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Arlana Carvalho (RH)"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={facilitador}
                    onChange={(e) => setFacilitador(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Carga Horária (Sessão)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={cargaHoraria}
                    onChange={(e) => setCargaHoraria(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade / Sede</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                  >
                    {unidadesList.map((u, i) => (
                      <option key={i} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Público Alvo / Participantes</label>
                <input
                  type="text"
                  placeholder="Ex: Auxiliares e Analistas Gerais"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  value={publico}
                  onChange={(e) => setPublico(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Qtd Prevista</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    value={qtdPrevista}
                    onChange={(e) => setQtdPrevista(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Qtd Realizada</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    value={qtdRealizada}
                    onChange={(e) => setQtdRealizada(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Valor Investido</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    value={valorInvestido}
                    onChange={(e) => setValorInvestido(Number(e.target.value))}
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
                  {editingTreinamento ? 'Atualizar Treinamento' : 'Salvar Treinamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
