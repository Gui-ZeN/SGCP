import React from 'react';
import { Vaga, Treinamento, Experiencia, Entrevista, Turnover } from '../types';
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
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const parseDateDDMMYYYY = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

  const getDiasEmAberto = (vaga: Vaga): number => {
    if (vaga.status === 'FECHADA') {
      return vaga.tempoProcesso || 0;
    }
    const dateSol = parseDateDDMMYYYY(vaga.solicitacao);
    if (!dateSol) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateSol.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - dateSol.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  };

  const getSedeSigla = (nome: string) => {
    const matched = sedes?.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return matched && matched.sigla ? matched.sigla : nome;
  };

  const vagasComAlertaSla = React.useMemo(() => {
    return filteredVagas
      .filter(v => ['ABERTA', 'REABERTA', 'PAUSADA', 'SUSPENSA', 'DOCUMENTAÇÃO'].includes(v.status.toUpperCase()))
      .map(v => ({
        ...v,
        dias: getDiasEmAberto(v)
      }))
      .filter(v => v.dias > 20)
      .sort((a, b) => b.dias - a.dias);
  }, [filteredVagas]);  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
        <div className="absolute top-0 right-0 -m-20 w-96 h-96 bg-gradient-to-br from-orange-100 to-rose-100 rounded-full blur-[80px] opacity-60"></div>
        <div className="absolute bottom-0 left-10 -m-20 w-72 h-72 bg-gradient-to-br from-blue-100 to-teal-100 rounded-full blur-[80px] opacity-60"></div>
        
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Stat 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition hover:shadow-md group cursor-pointer" onClick={() => setActiveTab('vagas')}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Atualizado agora</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-1">{vagasAbertas}</h3>
            <p className="text-xs font-bold text-slate-500">Vagas ativas no momento</p>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition hover:shadow-md group cursor-pointer" onClick={() => setActiveTab('treinamentos')}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">T&D Mensal</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-1">{treinamentosRealizados}</h3>
            <p className="text-xs font-bold text-slate-500">Participações em Treinamentos</p>
          </div>
        </div>

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
              <p className="text-[11px] font-semibold text-slate-400">Vagas ativas que ultrapassaram o objetivo de 20 dias em aberto</p>
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
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5 max-w-sm">Nenhuma vaga ativa excedeu o limite de segurança de 20 dias.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vagasComAlertaSla.map((v) => (
                <div 
                  key={v.id} 
                  onClick={() => setActiveTab('vagas')}
                  className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 hover:border-rose-200 rounded-xl p-3.5 transition group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4 className="font-bold text-slate-800 text-xs leading-snug group-hover:text-rose-600 transition-colors line-clamp-1">{v.vaga}</h4>
                      <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-md font-mono">
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
              ))}
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

         </div>
      </div>

    </div>
  
  );
};
