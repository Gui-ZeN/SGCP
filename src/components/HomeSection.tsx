import React from 'react';
import { Vaga, Treinamento, Experiencia, Entrevista, Turnover } from '../types';
import { getDiasEmAberto } from '../utils/vaga';
import { SLA_META_DIAS } from '../constants/hr';
import { useTheme } from '../hooks/useTheme';
import { Sede } from '../hooks/useMetadata';
import { 
  Building2, 
  ArrowRight,
  Sparkles,
  Users,
  Target,
  GraduationCap,
  Calendar,
  Briefcase,
  AlertTriangle,
  MapPin,
  Layers,
  Clock,
  ShieldCheck
} from 'lucide-react';

interface HomeSectionProps {
  vagas: Vaga[];
  treinamentos: Treinamento[];
  experiencias: Experiencia[];
  entrevistas: Entrevista[];
  turnover: Turnover[];
  setActiveTab: (tab: any) => void;
  onFocusVaga?: (vaga: any) => void;
  userName?: string;
  sedes?: Sede[];
  userSede?: string;
  isAdmin?: boolean;
}

export const HomeSection: React.FC<HomeSectionProps> = ({ 
  vagas, 
  treinamentos, 
  experiencias, 
  entrevistas,
  setActiveTab,
  onFocusVaga,
  userName,
  sedes = [],
  userSede,
  isAdmin = false
}) => {
  const filteredVagas = React.useMemo(() => {
    if (!isAdmin && userSede) {
      return vagas.filter(v => v.sede && v.sede.toLowerCase() === userSede.toLowerCase());
    }
    return vagas;
  }, [vagas, isAdmin, userSede]);

  const filteredTreinamentos = React.useMemo(() => {
    if (!isAdmin && userSede) {
      return treinamentos.filter(t => t.unidade && t.unidade.toLowerCase() === userSede.toLowerCase());
    }
    return treinamentos;
  }, [treinamentos, isAdmin, userSede]);

  const vagasAbertas = filteredVagas.filter(v => ['ABERTA', 'REABERTA'].includes(v.status.toUpperCase())).length;
  const treinamentosRealizados = filteredTreinamentos.reduce((acc, t) => acc + (t.qtdRealizada || 0), 0);
  const expAtivas = experiencias.filter(e => ['EM_ANALISE', 'PRORROGADO'].includes(e.status)).length;
  const climaMedio = entrevistas.length
    ? (entrevistas.reduce((a, e) => a + (e.notaClimaOrg || 0), 0) / entrevistas.length).toFixed(1).replace('.', ',')
    : '—';
  const hojeLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // getDiasEmAberto agora vem de ../utils/vaga (com congelamento de pausa).

  const getSedeSigla = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? matched.sigla : nome;
  };

  const vagasComAlertaSla = React.useMemo(() => {
    return filteredVagas
      // Pausadas/suspensas ficam de fora: o relógio delas está congelado, não é "ação imediata".
      .filter(v => ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'].includes(v.status.toUpperCase()))
      .map(v => ({
        ...v,
        dias: getDiasEmAberto(v)
      }))
      .filter(v => v.dias > SLA_META_DIAS)
      .sort((a, b) => b.dias - a.dias);
  }, [filteredVagas]);

  const heroStats = [
    { tab: 'vagas', icon: Briefcase, value: vagasAbertas, label: 'Vagas ativas no momento', badge: 'Atualizado agora', color: 'orange' },
    { tab: 'treinamentos', icon: GraduationCap, value: treinamentosRealizados, label: 'Participações em treinamentos', badge: 'T&D mensal', color: 'emerald' },
    { tab: 'experiencias', icon: ShieldCheck, value: expAtivas, label: 'Em período de experiência', badge: '45 / 90 dias', color: 'indigo' },
    { tab: 'entrevistas', icon: Sparkles, value: climaMedio, label: 'Clima organizacional médio', badge: 'Saídas · / 5', color: 'amber' }
  ] as const;

  // No Suíço os 4 cards usam um único acento cobalto (ousado e coeso); no Clássico,
  // a variedade colorida original. (As classes indigo viram cobalto via swiss.css.)
  const theme = useTheme();
  const swissChip = 'bg-indigo-50 text-indigo-600';
  const STAT_COLOR: Record<string, { chip: string; bar: string }> = theme === 'swiss'
    ? {
        orange: { chip: swissChip, bar: 'bg-indigo-500' },
        emerald: { chip: swissChip, bar: 'bg-indigo-500' },
        indigo: { chip: swissChip, bar: 'bg-indigo-500' },
        amber: { chip: swissChip, bar: 'bg-indigo-500' }
      }
    : {
        orange: { chip: 'bg-orange-50 text-orange-600', bar: 'bg-orange-400' },
        emerald: { chip: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400' },
        indigo: { chip: 'bg-indigo-50 text-indigo-600', bar: 'bg-indigo-400' },
        amber: { chip: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' }
      };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
        <div className="absolute top-0 right-0 -m-20 w-96 h-96 bg-gradient-to-br from-orange-100 to-rose-100 rounded-full blur-[80px] opacity-60"></div>
        <div className="absolute bottom-0 left-10 -m-20 w-72 h-72 bg-gradient-to-br from-blue-100 to-teal-100 rounded-full blur-[80px] opacity-60"></div>

        <div className="absolute top-6 right-6 z-10 hidden sm:flex items-center gap-2 bg-white/70 backdrop-blur border border-slate-200/70 rounded-full px-3 py-1.5 shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[11px] font-bold text-slate-600 capitalize">{hojeLabel}</span>
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-orange-50 rounded-xl border border-orange-100">
               <Building2 className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-slate-400">SGPC</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight leading-tight mb-3">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">{userName || 'Gestor'}</span>.
            <br /> O que vamos analisar?
          </h1>
          
          <p className="text-sm md:text-base text-slate-500 font-medium max-w-2xl leading-relaxed mb-6">
            Acompanhe indicadores, supervisione recrutamentos, controle o desenvolvimento do seu time e monitore o clima organizacional.
          </p>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setActiveTab('vagas')}
              className="px-5 py-3 bg-slate-900 text-white rounded-xl font-extrabold text-sm hover:bg-slate-800 transition flex items-center gap-2 group shadow-md shadow-slate-900/10 cursor-pointer"
            >
              Consultar Vagas 
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
               onClick={() => setActiveTab('dashboard')}
              className="px-5 py-3 bg-white text-slate-700 border border-slate-200 shadow-sm rounded-xl font-extrabold text-sm hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer"
            >
              <Target className="w-4 h-4 text-orange-500" />
              Painel de Indicadores
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {heroStats.map((s, i) => {
          const c = STAT_COLOR[s.color];
          const Icon = s.icon;
          return (
            <div
              key={i}
              onClick={() => setActiveTab(s.tab)}
              className="group relative bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer overflow-hidden"
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${c.bar} opacity-80`} />
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2.5 ${c.chip} rounded-xl group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-right max-w-[40%] leading-tight">{s.badge}</span>
              </div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-1">{s.value}</h3>
              <p className="text-xs font-bold text-slate-500">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Alertas de SLA Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-rose-50/40 via-transparent to-transparent flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight flex flex-wrap items-center gap-1.5">
                Alertas de SLA
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 rounded-md px-1.5 py-0.5 ml-1">Para Ação Imediata</span>
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">Vagas ativas que ultrapassaram o objetivo de {SLA_META_DIAS} dias em aberto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${vagasComAlertaSla.length > 0 ? 'bg-rose-500 text-white animate-bounce' : 'bg-slate-150 text-slate-600'}`}>
              {vagasComAlertaSla.length} {vagasComAlertaSla.length === 1 ? 'vaga' : 'vagas'}
            </span>
          </div>
        </div>

        <div className="p-5">
          {vagasComAlertaSla.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Todas as vagas saudáveis!</h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5 max-w-sm">Nenhuma vaga ativa excedeu o limite de segurança de {SLA_META_DIAS} dias.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vagasComAlertaSla.map((v) => {
                const sev = v.dias > 60
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : v.dias > 40
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200';
                return (
                <div
                  key={v.id}
                  onClick={() => onFocusVaga ? onFocusVaga(v) : setActiveTab('vagas')}
                  className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 hover:border-rose-200 rounded-xl p-3.5 transition group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4 className="font-bold text-slate-800 text-xs leading-snug group-hover:text-rose-600 transition-colors line-clamp-1">{v.vaga}</h4>
                      <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 border rounded-md font-mono ${sev}`}>
                        {v.dias} dias
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="inline-flex items-center gap-1 bg-white border border-slate-150 rounded-md px-1 py-0.5 text-[8px] font-bold text-slate-500 font-mono">
                        <MapPin className="w-2 h-2 text-slate-400 shrink-0" />
                        {getSedeSigla(v.sede)}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-white border border-slate-150 rounded-md px-1 py-0.5 text-[8px] font-bold text-slate-500">
                        <Layers className="w-2 h-2 text-slate-400 shrink-0" />
                        {v.setor}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-semibold gap-1 shrink-0">
                    <div className="truncate">
                      <span className="text-slate-500">Solic:</span> {v.solicitante}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 shrink-0 select-none">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span>{v.solicitacao}</span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Shortcuts List */}
      <div>
         <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Acesso Rápido</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            <button onClick={() => setActiveTab('experiencias')} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition group text-left cursor-pointer">
               <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Calendar className="w-4 h-4" />
               </div>
               <div>
                  <div className="text-xs font-bold text-slate-800">Acomp. de Experiência</div>
                  <div className="text-[10px] font-semibold text-slate-400">Ver painel 45/90 dias</div>
               </div>
            </button>
            
            <button onClick={() => setActiveTab('entrevistas')} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-sm transition group text-left cursor-pointer">
               <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                  <Users className="w-4 h-4" />
               </div>
               <div>
                  <div className="text-xs font-bold text-slate-800">Entrevistas de Saída</div>
                  <div className="text-[10px] font-semibold text-slate-400">Verificar clima e feedbacks</div>
               </div>
            </button>
            
            <button onClick={() => setActiveTab('turnover')} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition group text-left cursor-pointer">
               <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Target className="w-4 h-4" />
               </div>
               <div>
                  <div className="text-xs font-bold text-slate-800">Cálculo de Turnover</div>
                  <div className="text-[10px] font-semibold text-slate-400">Simular taxas e impactos</div>
               </div>
            </button>

            <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition group text-left cursor-pointer">
               <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                  <Target className="w-4 h-4" />
               </div>
               <div>
                  <div className="text-xs font-bold text-slate-800">Painel de Indicadores</div>
                  <div className="text-[10px] font-semibold text-slate-400">SLA, clima e turnover</div>
               </div>
            </button>

         </div>
      </div>

    </div>
  
  );
};
