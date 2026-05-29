/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Experiencia } from '../types';
import { Sede } from '../hooks/useMetadata';
import { 
  ShieldCheck, 
  Search, 
  MapPin, 
  User, 
  Clock, 
  TrendingUp, 
  PlusCircle, 
  Calendar,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  Trash2
} from 'lucide-react';

interface ExperienciasSectionProps {
  experiencias: Experiencia[];
  addExperiencia: (input: Omit<Experiencia, 'id' | 'termino1' | 'termino2'>) => Promise<void>;
  updateExperiencia: (id: string, updatedFields: Partial<Experiencia>) => Promise<void>;
  deleteExperiencia: (id: string) => Promise<void>;
  confirmAction?: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
  sedes?: Sede[];
}

interface ReviewAlert {
  type: 'danger' | 'warning' | 'info' | 'success' | 'none';
  label: string;
  days: number;
  message: string;
}

// Date utilities
const parseBRDate = (str: string): Date | null => {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

const getDaysDifference = (targetDateStr: string): number => {
  const target = parseBRDate(targetDateStr);
  if (!target) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getReviewAlert = (e: Experiencia): ReviewAlert => {
  if (e.status === 'EFETIVADO' || e.status === 'ENCERRADO') {
    return { type: 'success', label: 'Concluído', days: 0, message: 'Processo concluído' };
  }

  const diff45 = getDaysDifference(e.termino1);
  const diff90 = getDaysDifference(e.termino2);

  if (e.status === 'EM_ANALISE') {
    if (diff45 < 0) {
      return {
        type: 'danger',
        label: 'Atrasado (45d)',
        days: diff45,
        message: `Avaliação de 45 dias atrasada há ${Math.abs(diff45)} ${Math.abs(diff45) === 1 ? 'dia' : 'dias'} (${e.termino1})`
      };
    } else if (diff45 === 0) {
      return {
        type: 'danger',
        label: 'Vence Hoje (45d)',
        days: 0,
        message: `Avaliação de 45 dias deve ser realizada HOJE! (${e.termino1})`
      };
    } else if (diff45 <= 7) {
      return {
        type: 'warning',
        label: 'Urgente (45d)',
        days: diff45,
        message: `Avaliação de 45 dias vence em ${diff45} ${diff45 === 1 ? 'dia' : 'dias'} (${e.termino1})`
      };
    } else if (diff45 <= 15) {
      return {
        type: 'info',
        label: 'Em breve (45d)',
        days: diff45,
        message: `Avaliação de 45 dias em ${diff45} dias (${e.termino1})`
      };
    } else {
      return {
        type: 'none',
        label: 'No prazo',
        days: diff45,
        message: `${diff45} dias restantes para avaliação de 45 dias`
      };
    }
  } else if (e.status === 'PRORROGADO') {
    if (diff90 < 0) {
      return {
        type: 'danger',
        label: 'Atrasado (90d)',
        days: diff90,
        message: `Avaliação final de 90 dias atrasada há ${Math.abs(diff90)} ${Math.abs(diff90) === 1 ? 'dia' : 'dias'} (${e.termino2})`
      };
    } else if (diff90 === 0) {
      return {
        type: 'danger',
        label: 'Vence Hoje (90d)',
        days: 0,
        message: `Avaliação final de 90 dias deve ser realizada HOJE! (${e.termino2})`
      };
    } else if (diff90 <= 7) {
      return {
        type: 'warning',
        label: 'Urgente (90d)',
        days: diff90,
        message: `Avaliação final de 90 dias vence em ${diff90} ${diff90 === 1 ? 'dia' : 'dias'} (${e.termino2})`
      };
    } else if (diff90 <= 15) {
      return {
        type: 'info',
        label: 'Em breve (90d)',
        days: diff90,
        message: `Avaliação final de 90 dias em ${diff90} dias (${e.termino2})`
      };
    } else {
      return {
        type: 'none',
        label: 'No prazo',
        days: diff90,
        message: `${diff90} dias restantes para decisão de 90 dias`
      };
    }
  }

  return { type: 'none', label: 'Válido', days: 999, message: 'Acompanhamento ativo' };
};

export const ExperienciasSection: React.FC<ExperienciasSectionProps> = ({
  experiencias,
  addExperiencia,
  updateExperiencia,
  deleteExperiencia,
  confirmAction,
  sedes = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTableTab, setActiveTableTab] = useState<'ativos' | 'efetivados' | 'encerrados'>('ativos');
  const [selectedSede, setSelectedSede] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // New review form
  const [colaborador, setColaborador] = useState('');
  const [funcao, setFuncao] = useState('');
  const [setor, setSetor] = useState('Infra');
  const [sede, setSede] = useState(sedes[0]?.nome || '');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Stats
  const stats = useMemo(() => {
    let emAnalise = 0;
    let prorrogado = 0;
    let efetivado = 0;
    let encerrado = 0;

    experiencias.forEach(e => {
      if (e.status === 'EM_ANALISE') emAnalise++;
      else if (e.status === 'PRORROGADO') prorrogado++;
      else if (e.status === 'EFETIVADO') efetivado++;
      else if (e.status === 'ENCERRADO') encerrado++;
    });

    const totalConcluidos = efetivado + encerrado;
    const taxaRetencao = totalConcluidos > 0 ? Math.round((efetivado / totalConcluidos) * 100) : 100;

    return {
      emAnalise,
      prorrogado,
      efetivado,
      encerrado,
      taxaRetencao,
      totalAtivos: emAnalise + prorrogado
    };
  }, [experiencias]);

  // Options
  const sectorsList = ["TI", "Jurídico", "Idiomas DT", "Pedagógico", "Infra", "Coordenação", "Lojinha", "Secretaria", "Cantina", "CPA", "SOM", "D. Valéria"].sort((a,b) => a.localeCompare(b));

  // Filtered
  const filteredList = useMemo(() => {
    return experiencias.filter(e => {
      const matchText = !searchTerm.trim() || 
        e.colaborador.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.funcao.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.supervisor.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesTab = false;
      if (activeTableTab === 'ativos') {
        matchesTab = e.status === 'EM_ANALISE' || e.status === 'PRORROGADO';
      } else if (activeTableTab === 'efetivados') {
        matchesTab = e.status === 'EFETIVADO';
      } else if (activeTableTab === 'encerrados') {
        matchesTab = e.status === 'ENCERRADO';
      }

      const matchSede = !selectedSede || e.sede === selectedSede;

      return matchText && matchesTab && matchSede;
    });
  }, [experiencias, searchTerm, activeTableTab, selectedSede]);

  // Due / Urgent reviews summary for Notification Center
  const dueReviewsSummary = useMemo(() => {
    const overdue: { exp: Experiencia; alert: ReviewAlert }[] = [];
    const urgent: { exp: Experiencia; alert: ReviewAlert }[] = [];

    experiencias.forEach(e => {
      const alert = getReviewAlert(e);
      if (alert.type === 'danger') {
        overdue.push({ exp: e, alert });
      } else if (alert.type === 'warning') {
        urgent.push({ exp: e, alert });
      }
    });

    return { overdue, urgent };
  }, [experiencias]);

  const renderAlertBadge = (alert: ReviewAlert) => {
    if (alert.type === 'none' || alert.type === 'success') {
      if (alert.type === 'success') {
        return null;
      }
      return (
        <span className="inline-flex mt-1 text-[9.5px] font-extrabold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded leading-none whitespace-nowrap">
          {alert.label} ({alert.days}d rest.)
        </span>
      );
    }

    const colorClasses = 
      alert.type === 'danger' 
        ? 'bg-red-50 text-red-700 border-red-200/90' 
        : alert.type === 'warning' 
        ? 'bg-amber-50 text-amber-850 border-amber-205/90' 
        : 'bg-blue-50 text-blue-700 border-blue-200/95';

    return (
      <div className={`inline-flex items-center gap-1.5 mt-1 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase rounded border ${colorClasses} leading-none max-w-full truncate whitespace-nowrap`} title={alert.message}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          alert.type === 'danger' ? 'bg-red-600 animate-pulse' : 'bg-amber-500 animate-pulse'
        }`} />
        <span className="truncate">{alert.label}</span>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!colaborador.trim() || !funcao.trim() || !dataAdmissao.trim() || !sede) {
      setErrorMsg("Por favor, preencha o nome do Colaborador, a Função, a Sede/Unidade e a Data de Admissão.");
      return;
    }

    // Adapt standard YYYY-MM-DD input date to Brazilian format if necessary
    let formattedAdm = dataAdmissao;
    if (dataAdmissao.includes('-')) {
      const parts = dataAdmissao.split('-');
      formattedAdm = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    await addExperiencia({
      colaborador,
      funcao,
      setor,
      sede,
      dataAdmissao: formattedAdm,
      supervisor,
      observacoes,
      status: 'EM_ANALISE'
    });

    // Reset
    setColaborador('');
    setFuncao('');
    setDataAdmissao('');
    setSupervisor('');
    setObservacoes('');
    setErrorMsg('');
    setShowAddForm(false);
  };

  // Change status helper with action click
  const handleStatusChange = async (id: string, newStatus: Experiencia['status']) => {
    await updateExperiencia(id, { status: newStatus });
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-orange-500" />
            Controle de Experiência (45 e 90 dias)
          </h2>
          <p className="text-slate-500 text-sm font-medium">Monitore datas limites de vencimento de períodos de teste de novos colaboradores.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-slate-900/15 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          Novo Acompanhamento
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ativos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Período de Teste</div>
            <div className="text-md font-bold text-slate-800">{stats.totalAtivos} ativos</div>
          </div>
        </div>

        {/* Efetivados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Efetivados</div>
            <div className="text-md font-bold text-slate-800">{stats.efetivado} colaboradores</div>
          </div>
        </div>

        {/* Retenção */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Taxa de Retenção</div>
            <div className="text-md font-bold text-slate-800">{stats.taxaRetencao}%</div>
          </div>
        </div>

        {/* Encerrados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Desligados / Encerrados</div>
            <div className="text-md font-bold text-slate-800">{stats.encerrado} colaboradores</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500"
            placeholder="Pesquisar por Colaborador ou Supervisor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 font-medium"
          value={selectedSede}
          onChange={(e) => setSelectedSede(e.target.value)}
        >
          <option value="">Todas as Sedes / Unidades</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.nome}>{s.nome}</option>
          ))}
        </select>
      </div>

      {/* Experience Alert/Notification Center */}
      {(dueReviewsSummary.overdue.length > 0 || dueReviewsSummary.urgent.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4 animate-in fade-in duration-250">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-4.5 h-4.5 text-red-500 animate-bounce" />
              <span>Central de Avisos: Prazos de Experiência</span>
            </h3>
            <span className="text-[9.5px] bg-red-100 text-red-750 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-red-200">
              {dueReviewsSummary.overdue.length + dueReviewsSummary.urgent.length} Avaliações Requeridas
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overdue Alerts */}
            {dueReviewsSummary.overdue.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-red-650 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                  Prazo Vencido (Ação Urgente)
                </div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {dueReviewsSummary.overdue.map(({ exp, alert }) => (
                    <div key={exp.id} className="p-2.5 rounded-xl bg-red-50/40 border border-red-100/70 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-800 block truncate">{exp.colaborador}</span>
                        <span className="text-[10px] text-red-800 font-bold block truncate mt-0.5">{alert.message}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {exp.status === 'EM_ANALISE' ? (
                          <>
                            <button
                              onClick={() => handleStatusChange(exp.id, 'PRORROGADO')}
                              className="px-2 py-1 text-[9px] uppercase font-black bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition-all"
                            >
                              Prorrogar
                            </button>
                            <button
                              onClick={() => handleStatusChange(exp.id, 'EFETIVADO')}
                              className="px-2 py-1 text-[9px] uppercase font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-all"
                            >
                              Efetivar
                            </button>
                          </>
                        ) : exp.status === 'PRORROGADO' ? (
                          <button
                            onClick={() => handleStatusChange(exp.id, 'EFETIVADO')}
                            className="px-2 py-1 text-[9px] uppercase font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-all"
                          >
                            Efetivar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Urgent Alerts */}
            {dueReviewsSummary.urgent.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Vencendo nos próximos 7 dias
                </div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {dueReviewsSummary.urgent.map(({ exp, alert }) => (
                    <div key={exp.id} className="p-2.5 rounded-xl bg-amber-50/40 border border-amber-100/70 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-800 block truncate">{exp.colaborador}</span>
                        <span className="text-[10px] text-amber-800 font-bold block truncate mt-0.5">{alert.message}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {exp.status === 'EM_ANALISE' ? (
                          <>
                            <button
                              onClick={() => handleStatusChange(exp.id, 'PRORROGADO')}
                              className="px-2 py-1 text-[9px] uppercase font-black bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition-all"
                            >
                              Prorrogar
                            </button>
                            <button
                              onClick={() => handleStatusChange(exp.id, 'EFETIVADO')}
                              className="px-2 py-1 text-[9px] uppercase font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-all"
                            >
                              Efetivar
                            </button>
                          </>
                        ) : exp.status === 'PRORROGADO' ? (
                          <button
                            onClick={() => handleStatusChange(exp.id, 'EFETIVADO')}
                            className="px-2 py-1 text-[9px] uppercase font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-all"
                          >
                            Efetivar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Segment Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-1.5 md:gap-6 mt-2 select-none">
        <button
          onClick={() => setActiveTableTab('ativos')}
          className={`pb-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTableTab === 'ativos'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTableTab === 'ativos' ? 'text-orange-500 animate-pulse' : 'text-slate-450'}`} />
          <span>Em Experiência</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTableTab === 'ativos' ? 'bg-orange-100 text-orange-750' : 'bg-slate-100 text-slate-500'}`}>
            {stats.emAnalise + stats.prorrogado}
          </span>
        </button>

        <button
          onClick={() => setActiveTableTab('efetivados')}
          className={`pb-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTableTab === 'efetivados'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <CheckCircle className={`w-4 h-4 ${activeTableTab === 'efetivados' ? 'text-emerald-500' : 'text-slate-450'}`} />
          <span>Efetivados</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTableTab === 'efetivados' ? 'bg-emerald-100 text-emerald-755' : 'bg-slate-100 text-slate-500'}`}>
            {stats.efetivado}
          </span>
        </button>

        <button
          onClick={() => setActiveTableTab('encerrados')}
          className={`pb-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTableTab === 'encerrados'
              ? 'border-slate-500 text-slate-705'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <AlertCircle className={`w-4 h-4 ${activeTableTab === 'encerrados' ? 'text-slate-600' : 'text-slate-450'}`} />
          <span>Encerrados</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTableTab === 'encerrados' ? 'bg-slate-200 text-slate-750' : 'bg-slate-100 text-slate-500'}`}>
            {stats.encerrado}
          </span>
        </button>
      </div>

      {/* Main List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                <th className="py-3.5 px-4 w-1/3">Colaborador / Posição</th>
                <th className="py-3.5 px-4">Ciclo de Avaliação</th>
                <th className="py-3.5 px-4">Supervisor</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 font-medium">
                    Nenhum colaborador em período de experiência registrado.
                  </td>
                </tr>
              ) : (
                filteredList.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{e.colaborador}</div>
                      <div className="font-semibold text-slate-600 mt-0.5">{e.funcao}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {e.sede ? (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-orange-700 bg-orange-50 border border-orange-150 px-1.5 py-0.5 rounded-md uppercase tracking-wider leading-none">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            {e.sede}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md uppercase tracking-wider leading-none">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            Sem Sede
                          </span>
                        )}
                        <span className="text-[9.5px] text-slate-400 font-black tracking-widest">•</span>
                        <span className="text-[10px] text-slate-500 font-extrabold bg-slate-100/70 border border-slate-200/70 px-1.5 py-0.5 rounded-md leading-none">{e.setor}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Admissão: <span className="text-slate-600">{e.dataAdmissao}</span></div>
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-orange-800 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">45d: {e.termino1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-orange-850 font-bold bg-orange-50/50 px-1.5 py-0.5 rounded border border-orange-100">90d: {e.termino2}</span>
                        </div>
                        {renderAlertBadge(getReviewAlert(e))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{e.supervisor || 'RH'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {e.status === 'EM_ANALISE' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                          Sob Análise
                        </span>
                      )}
                      {e.status === 'PRORROGADO' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          Prorrogado
                        </span>
                      )}
                      {e.status === 'EFETIVADO' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Efetivado!
                        </span>
                      )}
                      {e.status === 'ENCERRADO' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          Desligado
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {/* Action trigger menu shortcuts */}
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {e.status === 'EM_ANALISE' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(e.id, 'PRORROGADO')}
                              className="px-2 py-1 text-[10px] uppercase font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer"
                              title="Prorrogar contrato"
                            >
                              Prorrogar
                            </button>
                            <button
                              onClick={() => handleStatusChange(e.id, 'EFETIVADO')}
                              className="px-2 py-1 text-[10px] uppercase font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer icon-flex gap-0.5"
                              title="Efetivar contratação"
                            >
                              Efetivar
                            </button>
                            <button
                              onClick={() => handleStatusChange(e.id, 'ENCERRADO')}
                              className="px-2 py-1 text-[10px] uppercase font-bold bg-rose-50 hover:bg-rose-150 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                              title="Encerrar/Desligar colaborador"
                            >
                              Encerrar
                            </button>
                          </>
                        )}
                        {e.status === 'PRORROGADO' && (
                          <button
                            onClick={() => handleStatusChange(e.id, 'EFETIVADO')}
                            className="px-2 py-1 text-[10px] uppercase font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer"
                          >
                            Efetivar
                          </button>
                        )}
                        {(e.status === 'EFETIVADO' || e.status === 'ENCERRADO') && (
                          <button
                            onClick={() => {
                              if (confirmAction) {
                                confirmAction(
                                  "Excluir Acompanhamento",
                                  `Você tem certeza de que deseja remover permanentemente o acompanhamento de período de experiência de "${e.colaborador}"? Esta ação não afetará sua admissão primária.`,
                                  () => deleteExperiencia(e.id)
                                );
                              } else {
                                if (confirm(`Remover definitivamente acompanhamento de ${e.colaborador}?`)) {
                                  deleteExperiencia(e.id);
                                }
                              }
                            }}
                            className="p-1 px-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg cursor-pointer transition border border-transparent hover:border-rose-100"
                            title="Limpar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PopUp Creation Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/65 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold">Adicionar Acompanhamento de Experiência</h3>
              </div>
              <button 
                onClick={() => { setErrorMsg(''); setShowAddForm(false); }} 
                className="text-slate-400 hover:text-white font-bold text-2xl cursor-pointer leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-700 font-bold shrink-0">!</span>
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo do Colaborador *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Camila Ferreira de Oliveira"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl font-medium"
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo / Função *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Analista de RH"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  value={funcao}
                  onChange={(e) => setFuncao(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sede / Unidade *</label>
                  <select
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                  >
                    <option value="">Selecione a Sede *</option>
                    {sedes.map((s) => (
                      <option key={s.id} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Setor / Área</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                  >
                    {sectorsList.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Admissão *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Supervisor Imediato</label>
                  <input
                    type="text"
                    placeholder="Ex: Eveline Santiago"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                    value={supervisor}
                    onChange={(e) => setSupervisor(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações / Requisitos Avaliados</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none rounded-xl"
                  placeholder="Particularidades avaliadas na adaptação comercial ou industrial..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setErrorMsg(''); setShowAddForm(false); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-sm font-bold rounded-xl text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-sm font-bold rounded-xl text-white shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  Salvar Acompanhamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
