/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Vaga, Treinamento, Experiencia, Entrevista, Turnover } from '../types';
import { Sede } from '../hooks/useMetadata';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  Briefcase, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  GraduationCap,
  Users,
  Target,
  LogOut,
  Star,
  MapPin,
  SmilePlus,
  AlertTriangle,
  Award,
  Filter,
  ChevronRight,
  FileText,
  UserCheck,
  AlertCircle,
  HelpCircle,
  DollarSign
} from 'lucide-react';

interface RecruitmentDashboardProps {
  vagas: Vaga[];
  treinamentos?: Treinamento[];
  experiencias?: Experiencia[];
  entrevistas?: Entrevista[];
  turnover?: Turnover[];
  sedes?: Sede[];
  userSede?: string;
  isAdmin?: boolean;
}

export const RecruitmentDashboard: React.FC<RecruitmentDashboardProps> = ({ 
  vagas, 
  treinamentos = [], 
  experiencias = [], 
  entrevistas = [], 
  turnover = [],
  sedes = [],
  userSede,
  isAdmin = false
}) => {
  const getSedeLabel = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? `${matched.nome} (${matched.sigla})` : nome;
  };

  const getSedeSigla = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? matched.sigla : nome;
  };

  // --- Estados de Filtros Interativos ---
  const [selectedSede, setSelectedSede] = useState<string>(() => {
    return !isAdmin && userSede ? userSede : 'TODAS';
  });
  const [selectedSetor, setSelectedSetor] = useState<string>('TODOS');
  const [selectedAno, setSelectedAno] = useState<string>('TODOS');

  React.useEffect(() => {
    if (!isAdmin && userSede) {
      setSelectedSede(userSede);
    }
  }, [userSede, isAdmin]);

  // --- Extração de Opções para Filtros ---
  const listSedes = useMemo(() => {
    const list = new Set<string>();
    vagas.forEach(v => { if (v.sede) list.add(v.sede); });
    
    const sortedList = Array.from(list).sort((a, b) => {
      if (userSede) {
        if (a.toLowerCase() === userSede.toLowerCase()) return -1;
        if (b.toLowerCase() === userSede.toLowerCase()) return 1;
      }
      return a.localeCompare(b);
    });
    
    return ['TODAS', ...sortedList];
  }, [vagas, userSede]);

  const listSetores = useMemo(() => {
    const list = new Set<string>();
    vagas.forEach(v => { if (v.setor) list.add(v.setor); });
    return ['TODOS', ...Array.from(list).sort()];
  }, [vagas]);

  const listAnos = useMemo(() => {
    const list = new Set<string>();
    vagas.forEach(v => { if (v.ano) list.add(String(v.ano)); });
    return ['TODOS', ...Array.from(list).sort()];
  }, [vagas]);

  // --- Aplicação dos Filtros ---
  const filteredVagas = useMemo(() => {
    return vagas.filter(v => {
      const matchSede = selectedSede === 'TODAS' || v.sede === selectedSede;
      const matchSetor = selectedSetor === 'TODOS' || v.setor === selectedSetor;
      const matchAno = selectedAno === 'TODOS' || String(v.ano) === selectedAno;
      return matchSede && matchSetor && matchAno;
    });
  }, [vagas, selectedSede, selectedSetor, selectedAno]);

  const filteredTreinamentos = useMemo(() => {
    return treinamentos.filter(t => {
      const matchSede = selectedSede === 'TODAS' || t.unidade === selectedSede;
      // Treinamentos não possuem campo setor diretamente, filtramos por sede
      return matchSede;
    });
  }, [treinamentos, selectedSede]);

  const filteredExperiencias = useMemo(() => {
    return experiencias.filter(e => {
      const matchSetor = selectedSetor === 'TODOS' || e.setor === selectedSetor;
      return matchSetor;
    });
  }, [experiencias, selectedSetor]);

  const filteredEntrevistas = useMemo(() => {
    return entrevistas.filter(e => {
      const matchSede = selectedSede === 'TODAS' || e.unidade === selectedSede;
      const matchSetor = selectedSetor === 'TODOS' || e.funcao.toLowerCase().includes(selectedSetor.toLowerCase());
      return matchSede && matchSetor;
    });
  }, [entrevistas, selectedSede, selectedSetor]);

  // --- KPIs Principais (Baseados em dados filtrados) ---
  const vagasAbertas = filteredVagas.filter(v => ['ABERTA', 'REABERTA'].includes(v.status.toUpperCase())).length;
  const closedVagas = filteredVagas.filter(v => v.status.toUpperCase() === 'FECHADA' && v.tempoProcesso && v.tempoProcesso > 0);
  const mediaSla = closedVagas.length > 0 
    ? Math.round(closedVagas.reduce((acc, curr) => acc + (curr.tempoProcesso || 0), 0) / closedVagas.length) 
    : 0;
  
  const totalInvestidoTreinamento = filteredTreinamentos.reduce((acc, t) => acc + (t.valorInvestido || 0), 0);
  const horasTotaisTreinamento = filteredTreinamentos.reduce((acc, t) => acc + (t.totalHorasFormacao || 0), 0);

  const mediaClima = filteredEntrevistas.length > 0 
    ? (filteredEntrevistas.reduce((acc, e) => acc + (e.notaClimaOrg || 0), 0) / filteredEntrevistas.length).toFixed(1) 
    : '0.0';
  const turnoverGeral = turnover.length > 0 ? turnover[turnover.length - 1].taxaTurnoverGeral : 0;

  // --- Vagas Status Chart Data ---
  const statusData = useMemo(() => {
    return [
      { name: 'Em andamento', value: filteredVagas.filter(v => ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'].includes(v.status.toUpperCase())).length, color: '#3b82f6' },
      { name: 'Fechadas', value: filteredVagas.filter(v => v.status.toUpperCase() === 'FECHADA').length, color: '#10b981' },
      { name: 'Pausadas/Canc', value: filteredVagas.filter(v => ['PAUSADA', 'SUSPENSA'].includes(v.status.toUpperCase())).length, color: '#f43f5e' },
    ];
  }, [filteredVagas]);

  // --- Vagas por Sede/Unidade (Top 6) ---
  const sedeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVagas.forEach(v => {
      const s = v.sede || 'Não informada';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts)
      .map(key => ({ name: getSedeSigla(key), quantidade: counts[key] }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 6);
  }, [filteredVagas, sedes]);

  // --- SLA Médio por Setor (Análise de Gargalos) ---
  const slaSetorChartData = useMemo(() => {
    const sum: Record<string, number> = {};
    const count: Record<string, number> = {};
    filteredVagas.forEach(v => {
      if (v.status.toUpperCase() === 'FECHADA' && v.tempoProcesso && v.tempoProcesso > 0) {
        const s = v.setor || 'Outros';
        sum[s] = (sum[s] || 0) + v.tempoProcesso;
        count[s] = (count[s] || 0) + 1;
      }
    });
    return Object.keys(sum)
      .map(k => ({ name: k, sla: Math.round(sum[k] / count[k]) }))
      .sort((a, b) => b.sla - a.sla)
      .slice(0, 6);
  }, [filteredVagas]);

  // --- Motivos de Abertura ---
  const motivoVagaData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVagas.forEach(v => {
      const s = v.categoriaMotivo || 'Outros';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts)
      .map(k => ({ name: k, total: counts[k] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [filteredVagas]);

  // --- Treinamentos Detalhado ---
  const trTypeMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTreinamentos.forEach(t => {
      map[t.tipo] = (map[t.tipo] || 0) + 1;
    });
    return Object.keys(map).map(k => ({ name: k, total: map[k] }));
  }, [filteredTreinamentos]);

  const aproveitamentoTreinamento = useMemo(() => {
    let presencaTot = 0, previsaoTot = 0;
    filteredTreinamentos.forEach(t => {
      presencaTot += t.qtdRealizada || 0;
      previsaoTot += t.qtdPrevista || 0;
    });
    return previsaoTot > 0 ? Math.round((presencaTot / previsaoTot) * 100) : 0;
  }, [filteredTreinamentos]);

  // --- Entrevistas/Saídas ---
  const motivosSaidaData = useMemo(() => {
    const motivos: Record<string, number> = {};
    filteredEntrevistas.forEach(e => {
      if (e.motivoSaida) motivos[e.motivoSaida] = (motivos[e.motivoSaida] || 0) + 1;
    });
    return Object.keys(motivos)
      .map(k => ({ name: k, total: motivos[k] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredEntrevistas]);

  const dimensoesClima = useMemo(() => {
    const countEnt = filteredEntrevistas.length || 1;
    return [
      { name: 'Remuneração', score: Number((filteredEntrevistas.reduce((a, e) => a + (e.notaSalario || 0), 0) / countEnt).toFixed(1)) },
      { name: 'Melhoria/Crescimento', score: Number((filteredEntrevistas.reduce((a, e) => a + (e.notaCrescimento || 0), 0) / countEnt).toFixed(1)) },
      { name: 'Treinamento', score: Number((filteredEntrevistas.reduce((a, e) => a + (e.notaTreinamento || 0), 0) / countEnt).toFixed(1)) },
      { name: 'Rel. Colegas', score: Number((filteredEntrevistas.reduce((a, e) => a + (e.notaRelacionamentoColegas || 0), 0) / countEnt).toFixed(1)) },
      { name: 'Rel. Gestão', score: Number((filteredEntrevistas.reduce((a, e) => a + (e.notaRelacionamentoChefia || 0), 0) / countEnt).toFixed(1)) },
    ];
  }, [filteredEntrevistas]);

  const taxaRetorno = useMemo(() => {
    let voltariaSim = 0;
    filteredEntrevistas.forEach(e => { if (['Sim', 'Talvez'].includes(e.voltaria)) voltariaSim++; });
    return filteredEntrevistas.length > 0 ? Math.round((voltariaSim / filteredEntrevistas.length) * 100) : 0;
  }, [filteredEntrevistas]);

  // --- Headcount Admissions vs Exits Flow ---
  const headcountFlowData = useMemo(() => {
    return turnover.map(t => {
      const exits = (t.pediramSair || 0) + (t.foramDesligados || 0);
      return {
        mes: t.mesAno,
        Admissões: t.totalAdmissao || 0,
        Desligamentos: exits,
        ContrataçõesLíquidas: (t.totalAdmissao || 0) - exits,
      };
    }).slice(-6); // Last 6 historical slots
  }, [turnover]);

  // --- Geração Automática de Insights Heurísticos (Rápidos / Offline) ---
  const heuristicInsights = useMemo(() => {
    const list: { type: 'danger' | 'warning' | 'success' | 'info'; text: string; title: string }[] = [];

    // Check SLA Bottlenecks
    if (mediaSla > 35) {
      list.push({
        type: 'danger',
        title: 'Tempo de Fechamento Crítico (SLA)',
        text: `O tempo médio atual de contratação de ${mediaSla} dias está acima da meta operacional recomendada de 30 dias. Considere revisar as etapas de avaliação técnica.`
      });
    } else if (mediaSla > 0 && mediaSla <= 25) {
      list.push({
        type: 'success',
        title: 'Excelente Eficiência no Recrutamento',
        text: `O tempo médio de contratação é de apenas ${mediaSla} dias. A agilidade nas etapas de triagem e admissão mantém o pipeline altamente otimizado.`
      });
    }

    // Check Clima Organizational Dimensões
    dimensoesClima.forEach(dim => {
      if (dim.score > 0 && dim.score < 3.2) {
        list.push({
          type: 'danger',
          title: `Satisfação Baixa em: ${dim.name}`,
          text: `A nota de ${dim.score}/5.0 indica insatisfação crítica. Este fator é um motivador primário no desligamento voluntário de colaboradores.`
        });
      } else if (dim.score >= 4.2) {
        list.push({
          type: 'success',
          title: `Destaque Positivo em: ${dim.name}`,
          text: `Colaboradores avaliaram este quesito com nota de ${dim.score}/5.0. Excelente fator de retenção orgânica de talentos.`
        });
      }
    });

    // Check Treinamento Aproveitamento
    if (aproveitamentoTreinamento > 0 && aproveitamentoTreinamento < 70) {
      list.push({
        type: 'warning',
        title: 'Evasão nos Treinamentos de Capacitação',
        text: `O aproveitamento das turmas de T&D está em ${aproveitamentoTreinamento}%. Há uma discrepância expressiva entre colaboradores previstos e presentes.`
      });
    }

    // Default insight if empty
    if (list.length === 0) {
      list.push({
        type: 'info',
        title: 'Indicadores Estáveis',
        text: 'Não foram detectados desvios ou anomalias críticas no período analisado. O funil de contratação e as pontuações de clima operam em níveis saudáveis.'
      });
    }

    return list;
  }, [mediaSla, dimensoesClima, aproveitamentoTreinamento]);

  return (
    <div className="space-y-6">
      
      {/* --- CABEÇALHO --- */}
      <div className="flex flex-col md:flex-row md:items-nowrap md:justify-between justify-start items-start gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-850 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6.5 h-6.5 text-indigo-600" />
            <span>Indicadores de Gestão Corporativa</span>
          </h2>
          <p className="text-slate-500 text-sm font-semibold">Análise de recrutamento, SLA, clima de desligamentos, rotatividade e programas de capacitação.</p>
        </div>

        {/* Dynamic filters in horizontal list */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto mt-2 md:mt-0">
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-2xl">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtros Ativos:</span>
          </div>

           {/* Sede Select */}
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-0.5">Sede</label>
            <select
              id="filter-sede-select"
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              className="text-xs bg-white border border-slate-250 py-1.5 px-3 rounded-xl font-bold text-slate-700 focus:border-indigo-500 focus:outline-none shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              <option value="TODAS">Sede: Todas</option>
              {listSedes.filter(s => s !== 'TODAS').map((s, idx) => (
                <option key={idx} value={s}>{getSedeSigla(s)}</option>
              ))}
            </select>
          </div>

          {/* Setor Select */}
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-0.5">Setor</label>
            <select
              id="filter-setor-select"
              value={selectedSetor}
              onChange={(e) => setSelectedSetor(e.target.value)}
              className="text-xs bg-white border border-slate-250 py-1.5 px-3 rounded-xl font-bold text-slate-700 focus:border-indigo-500 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="TODOS">Setor: Todos</option>
              {listSetores.filter(s => s !== 'TODOS').map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Ano Select */}
          <div className="flex flex-col flex-wrap">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-0.5">Ano</label>
            <select
              id="filter-ano-select"
              value={selectedAno}
              onChange={(e) => setSelectedAno(e.target.value)}
              className="text-xs bg-white border border-slate-250 py-1.5 px-3 rounded-xl font-bold text-slate-700 focus:border-indigo-500 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="TODOS">Ano: Todos</option>
              {listAnos.filter(a => a !== 'TODOS').map((a, idx) => (
                <option key={idx} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* --- CARDS DE PERFORMANCE OPERACIONAL --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card: Vagas Ativas */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-slate-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Vagas em Aberto</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4.5 h-4.5 text-orange-600" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{vagasAbertas}</h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>SLA médio de fechamento: <span className="text-orange-600 font-extrabold">{mediaSla} dias</span></span>
            </p>
          </div>
        </div>

        {/* Card: Turnover Mês */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-slate-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Turnover Médio Geral</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <LogOut className="w-4.5 h-4.5 text-rose-600" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{turnoverGeral}%</h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Baseado em <span className="text-slate-700 font-extrabold">{filteredEntrevistas.length} entrevistas</span> de saída</span>
            </p>
          </div>
        </div>

        {/* Card: Clima Organizacional */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-slate-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Clima Organizacional</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Star className="w-4.5 h-4.5 text-amber-500" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{mediaClima} <span className="text-sm text-slate-400 font-semibold">/ 5.0</span></h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
              <SmilePlus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Média e percepção de bem-estar</span>
            </p>
          </div>
        </div>

        {/* Card: Investimento T&D */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-slate-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Investimento T&D</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-4.5 h-4.5 text-emerald-600" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              {totalInvestidoTreinamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{horasTotaisTreinamento} horas aplicadas de capacitação</span>
            </p>
          </div>
        </div>

      </div>


      {/* --- DESTAQUES OPERACIONAIS --- */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertInfoIcon className="w-4.5 h-4.5 text-indigo-500" />
              Destaques Operacionais & Recomendações
            </h4>
            <span className="text-[9px] bg-indigo-50 text-indigo-650 px-2 py-0.5 rounded-full font-bold uppercase border border-indigo-150">On-The-Fly</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {heuristicInsights.map((ins, i) => (
              <div key={i} className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                ins.type === 'danger' ? 'bg-red-50/50 border-red-150/70' :
                ins.type === 'warning' ? 'bg-amber-50/50 border-amber-150/70' :
                ins.type === 'success' ? 'bg-emerald-50/50 border-emerald-150/70' :
                'bg-slate-50/60 border-slate-200'
              }`}>
                <div className="mt-0.5 shrink-0">
                  {ins.type === 'danger' && <AlertTriangle className="w-4 h-4 text-red-650" />}
                  {ins.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                  {ins.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                  {ins.type === 'info' && <HelpCircle className="w-4 h-4 text-slate-500" />}
                </div>
                <div>
                  <h5 className={`text-[11px] font-black leading-tight uppercase ${
                    ins.type === 'danger' ? 'text-red-950' :
                    ins.type === 'warning' ? 'text-amber-950' :
                    ins.type === 'success' ? 'text-emerald-950' :
                    'text-slate-800'
                  }`}>
                    {ins.title}
                  </h5>
                  <p className={`text-[10px] font-semibold leading-relaxed mt-1 ${
                    ins.type === 'danger' ? 'text-red-900/80' :
                    ins.type === 'warning' ? 'text-amber-900/80' :
                    ins.type === 'success' ? 'text-emerald-900/80' :
                    'text-slate-500'
                  }`}>
                    {ins.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 mt-5">
          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wide leading-none">Análise baseada nos filtros de dados ativos</span>
        </div>
      </div>


      {/* --- SEÇÃO GRAFICOS: RECRUTAMENTO --- */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-black text-slate-850 text-base mb-1.5 flex items-center gap-1.5">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          <span>Métricas de Recrutamento e Seleção</span>
        </h3>
        <p className="text-slate-450 text-xs font-semibold mb-6 border-b border-slate-100 pb-3">Indicadores e gráficos de representatividade, distribuição e SLA de contratação.</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Status de Vagas */}
          <div className="lg:col-span-3 bg-slate-50/50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-slate-400" />
                Status Vagas
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie 
                      data={statusData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={48} 
                      outerRadius={68} 
                      paddingAngle={3} 
                      dataKey="value"
                    >
                      {statusData.map((e, idx) => <Cell key={idx} fill={e.color} stroke="transparent" />)}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Vagas']} cursor={{fill: '#f1f5f9'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2 mt-4">
               {statusData.map((e, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px] font-bold">
                     <div className="flex items-center gap-2">
                       <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }}></span>
                       <span className="text-slate-650">{e.name}</span>
                     </div>
                     <span className="text-slate-800 font-extrabold">{e.value}</span>
                  </div>
               ))}
            </div>
          </div>

          {/* Vagas por Unidade */}
          <div className="lg:col-span-5 bg-slate-50/50 border border-slate-200 p-4 rounded-2xl flex flex-col">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
               <MapPin className="w-4 h-4 text-slate-400" />
               Vagas por Unidade (Top 6)
            </h4>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase mb-4">Volume total distribuído geograficamente</p>
            <div className="h-56 mt-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={sedeChartData} margin={{ top: 10, left: -25, right: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={10} stroke="#64748b" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis fontSize={10} stroke="#64748b" tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#fff', opacity: 0.5}} />
                  <Bar dataKey="quantidade" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SLA Médio por Setor */}
          <div className="lg:col-span-4 bg-slate-50/50 border border-slate-200 p-4 rounded-2xl flex flex-col">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
               <Clock className="w-4 h-4 text-slate-400" />
               Tempo de Fechamento (SLA) por Setor
            </h4>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase mb-4">Média de dias para fechamento em vagas concluídas</p>
            <div className="h-56 mt-auto">
              {slaSetorChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart layout="vertical" data={slaSetorChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" fontSize={10} stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" fontSize={10} stroke="#475569" tickLine={false} axisLine={false} width={80} />
                    <Tooltip cursor={{fill: '#fff', opacity: 0.5}} formatter={(value) => [`${value} dias`, 'SLA Médio']} />
                    <Bar dataKey="sla" fill="#ff7a00" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-4">
                  <Clock className="w-8 h-8 text-slate-350 mb-1.5" />
                  <p className="text-[11px] text-slate-500 font-bold text-center">Nenhum dado de SLA fechado para exibir neste filtro.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>


      {/* --- SEÇÃO GRAFICOS: RECURSOS HUMANOS GERAL --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Gráfico 1: Headcount Influx & Flow */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-black text-slate-800 text-base mb-1.5 flex items-center gap-1.5">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Fluxo de Headcount & Turnover</span>
            </h4>
            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wide mb-6">Comparação Semestral: Admissões vs Desligamentos</p>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={headcountFlowData} margin={{ top: 10, left: -25, right: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" fontSize={10} stroke="#64748b" tickLine={false} />
                  <YAxis fontSize={10} stroke="#64748b" tickLine={false} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="Admissões" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Desligamentos" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Gráfico 2: Pesquisa de Clima Detalhado */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-black text-slate-800 text-base mb-1.5 flex items-center gap-1.5">
              <SmilePlus className="w-5 h-5 text-indigo-600" />
              <span>Avaliação de Satisfação e Clima Org.</span>
            </h4>
            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wide mb-6">Feedback Coletado em Entrevistas de Desligamento (Nota 1-5)</p>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart layout="vertical" data={dimensoesClima} margin={{ top: 0, right: 10, left: 15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 5]} fontSize={10} stroke="#64748b" tickLine={false} />
                  <YAxis dataKey="name" type="category" fontSize={10} stroke="#334155" tickLine={false} width={110} />
                  <Tooltip formatter={(value) => [`${value} / 5.0`, 'Nota']} />
                  <Bar dataKey="score" fill="#10B981" radius={[0, 4, 4, 0]} barSize={14}>
                    {dimensoesClima.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.score >= 4.0 ? '#10b981' : entry.score >= 3.0 ? '#f59e0b' : '#ef4444'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>


      {/* --- SEÇÃO DE TREINAMENTO E INTEGRAÇÃO DE NOVOS COLABORADORES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Treinamentos de Equipe */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1.5 pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                Aproveitamento de Treinamentos
              </h4>
            </div>
            
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center justify-between mb-4 mt-2">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aproveitamento</span>
                <h3 className="text-2xl font-black text-slate-800 mt-1">{aproveitamentoTreinamento}%</h3>
                <span className="text-[9.5px] font-bold text-slate-500 mt-0.5 block">Presentes vs Planejado</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600">
                <Award className="w-5 h-5" />
              </div>
            </div>

            {trTypeMap.length > 0 ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={trTypeMap} margin={{ top: 0, left: -25, right: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={9} stroke="#64748b" tickLine={false} />
                    <YAxis fontSize={9} stroke="#64748b" tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                <GraduationCap className="w-8 h-8 text-slate-300 mb-1.5" />
                <p className="text-[10px] font-bold">Nenhum treinamento nesta unidade.</p>
              </div>
            )}
          </div>
        </div>

        {/* Motivos de Saída e Feedbacks */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-850 uppercase tracking-widest flex items-center gap-1.5 mb-1.5 border-b border-slate-100 pb-2">
              <LogOut className="w-5 h-5 text-indigo-600" />
              Pontos Críticos de Desligamento
            </h4>
            
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex items-center justify-between mb-4 mt-2">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Grau de Recomendabilidade</span>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{taxaRetorno}%</h3>
                <span className="text-[9.5px] font-bold text-slate-500 mt-0.5 block">Voltariam a integrar a empresa</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-150 flex items-center justify-center text-emerald-600">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-3.5 mt-2">
               {motivosSaidaData.map((m, i) => (
                 <div key={i}>
                    <div className="flex justify-between items-end mb-1 text-[11px] font-bold">
                      <span className="text-slate-700 truncate max-w-[80%]" title={m.name}>{m.name}</span>
                      <span className="text-[10px] text-slate-550 bg-slate-100 px-2 py-0.5 rounded-full">{m.total}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                       <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(m.total / (filteredEntrevistas.length || 1)) * 100}%` }}></div>
                    </div>
                 </div>
               ))}
               {motivosSaidaData.length === 0 && <p className="text-xs text-slate-400 text-center py-6 font-medium">Nenhuma entrevista no período analisado.</p>}
            </div>
          </div>
        </div>

        {/* Integração e Onboarding Experiências */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-850 uppercase tracking-widest flex items-center gap-1.5 mb-1.5 border-b border-slate-100 pb-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Integração de Novos Talentos
            </h4>

            <p className="text-[10px] text-slate-450 font-extrabold uppercase mt-3 mb-3.5">Painel Período de Experiência (45 e 90 dias)</p>

            <div className="space-y-3">
              <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between transition-colors">
                <div>
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-none">Novos Integrantes Selecionados</h5>
                  <h3 className="text-xl font-black text-slate-800 mt-2">{filteredExperiencias.length} <span className="text-xs text-slate-400 font-bold">colaboradores</span></h3>
                </div>
                <Users className="w-6 h-6 text-indigo-400 shrink-0" />
              </div>

              <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between transition-colors">
                <div>
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-none">Status de Retenção Ativa</h5>
                  <h3 className="text-xl font-black text-emerald-600 mt-2">
                    {filteredExperiencias.length > 0 
                      ? Math.round((filteredExperiencias.filter(e => e.status === 'EFETIVADO').length / filteredExperiencias.length) * 100) 
                      : 100}% <span className="text-[9.5px] text-slate-450 font-bold">efetivados</span>
                  </h3>
                </div>
                <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              </div>

              <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between transition-colors">
                <div>
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-none">Períodos Prorrogados/Ajustes</h5>
                  <h3 className="text-xl font-black text-amber-500 mt-2">
                    {filteredExperiencias.filter(e => e.status === 'PRORROGADO').length} <span className="text-xs text-slate-400 font-bold">em acompanhamento</span>
                  </h3>
                </div>
                <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

// --- SUB-ÍCONES AUXILIARES LOCAIS ---
const AlertInfoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const BrainCircuitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 18h.01" />
    <path d="M17 18h.01" />
    <path d="M7 18h.01" />
    <path d="M12 14h.01" />
    <path d="M12 10h.01" />
    <path d="M12 6h.01" />
    <path d="M16 14h.5a2.5 2.5 0 0 0 2.5-2.5V10" />
    <path d="M8 14h-.5A2.5 2.5 0 0 1 5 11.5V10" />
    <circle cx="12" cy="12" r="10" />
  </svg>
);
