import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Briefcase, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp, 
  Users, 
  Bot,
  Network,
  GraduationCap,
  ClipboardSignature,
  Activity,
  CheckCircle2
} from 'lucide-react';

interface LoginPageProps {
  onLogin: () => Promise<void>;
  isFirebaseEnabled: boolean;
  onSimulatedLogin: (email: string, name: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ 
  onLogin, 
  isFirebaseEnabled,
  onSimulatedLogin
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSimulateInput, setShowSimulateInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('guizen2006@gmail.com');
  const [customName, setCustomName] = useState('Guilherme Zen');

  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [isOrbitHovered, setIsOrbitHovered] = useState<boolean>(false);

  const handleGoogleClick = async () => {
    setIsConnecting(true);
    try {
      if (isFirebaseEnabled) {
        await onLogin();
      } else {
        // Simulated process to show a gorgeous transition
        await new Promise((resolve) => setTimeout(resolve, 1200));
        onSimulatedLogin(customEmail, customName);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  const modulesList = [
    {
      icon: <Briefcase className="w-5 h-5 text-orange-600" />,
      bg: 'bg-orange-50 border-orange-100',
      title: 'Quadro de Vagas',
      desc: 'Gestão visual de candidatos de forma ágil com filtros e triagem intuitiva.'
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50 border-indigo-100',
      title: 'Painel de Indicadores',
      desc: 'Análise detalhada de admissões, funil de recrutamento e status das vagas.'
    },
    {
      icon: <Activity className="w-5 h-5 text-rose-600" />,
      bg: 'bg-rose-50 border-rose-100',
      title: 'Turnover & Headcount',
      desc: 'Controles precisos de entradas e saídas para o cálculo imediato de rotatividade.'
    },
    {
      icon: <Users className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-100',
      title: 'Período de Experiência',
      desc: 'Acompanhe o onboarding de novos talentos e avaliações de clima de 45 e 90 dias.'
    },
    {
      icon: <GraduationCap className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-100',
      title: 'Treinamentos de Equipe',
      desc: 'Agenciador integrado de capacitação profissional e registro de facilitadores.'
    },
    {
      icon: <ClipboardSignature className="w-5 h-5 text-cyan-600" />,
      bg: 'bg-cyan-50 border-cyan-100',
      title: 'Entrevistas de Desligamento',
      desc: 'Mapeamento minucioso dos motivos de saída para diagnósticos de feedback.'
    },
    {
      icon: <Bot className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50 border-purple-100',
      title: 'Assistente IA do SGPC',
      desc: 'Modelagem automatizada de requisitos de cargo e suporte ativo inteligente.'
    }
  ];

  React.useEffect(() => {
    if (isOrbitHovered) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % modulesList.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isOrbitHovered, modulesList.length]);

  return (
    <div className="min-h-screen w-screen bg-slate-50 flex overflow-hidden font-sans relative">
      {/* Immersive Background Decorator Orbs */}
      <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-orange-400/10 to-transparent blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-indigo-400/12 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[30%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      {/* Grid Pattern with dynamic fade-out */}
      <div 
        className="absolute inset-0 opacity-[0.22] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(circle, #94a3b8 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 80%)',
        }}
      />

      {/* LEFT SIDE: Immersive Functional Modules Showcase */}
      <div className="hidden lg:flex lg:w-[54%] xl:w-[56%] relative flex-col justify-between p-12 overflow-y-auto border-r border-slate-200/80 bg-white/40 backdrop-blur-md select-none scrollbar-thin">
        
        {/* Upper Brand Badge */}
        <div className="flex items-center gap-3.5 z-10 shrink-0">
          <div className="w-11 h-11 bg-orange-500 bg-gradient-to-tr from-orange-600 to-orange-450 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 tracking-tight leading-none uppercase">
              SGPC <span className="text-[9px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-md border border-orange-500/20 ml-1 font-extrabold uppercase">RH</span>
            </h2>
            <p className="text-[10px] text-slate-450 font-bold tracking-wider uppercase mt-1">
              Sistema de Gestão de Pessoas Christus
            </p>
          </div>
        </div>

        {/* Centerpiece: Real Functional Features Wheel */}
        <div className="my-auto z-10 w-full flex flex-col items-center justify-center py-4 min-h-[500px]">
          <div className="mb-8 space-y-1 text-center w-full max-w-md">
            <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full border border-orange-100 text-[9px] font-black tracking-wider uppercase mb-1">
              <Sparkles className="w-3 h-3 text-orange-600 animate-pulse" />
              <span>Conheça os Módulos do Sistema</span>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Atração & Desenvolvimento Inteligente</h3>
            <p className="text-[11px] text-slate-500 font-bold leading-relaxed px-4">
              Passe o mouse ou toque nos ícones ao redor do círculo para alternar os módulos e visualizar as suas descrições completas.
            </p>
          </div>

          <div 
            className="relative w-[380px] h-[380px] flex items-center justify-center scale-95 md:scale-100 transition-transform origin-center"
            onMouseEnter={() => setIsOrbitHovered(true)}
            onMouseLeave={() => setIsOrbitHovered(false)}
          >
            {/* Pulsing orbital background lines */}
            <div className="absolute inset-4 border border-slate-200/60 rounded-full pointer-events-none scale-100 animate-pulse [animation-duration:8s]" />
            <div className="absolute inset-12 border border-dashed border-slate-250/50 rounded-full pointer-events-none animate-spin [animation-duration:140s]" />
            <div className="absolute inset-20 border border-slate-100/80 rounded-full pointer-events-none" />

            {/* Circular Orbit Ring line */}
            <svg className="absolute w-full h-full pointer-events-none overflow-visible opacity-40 select-none">
              <circle cx="190" cy="190" r="145" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            </svg>

            {/* Central Info Card */}
            <motion.div 
              key={activeIdx}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute w-[215px] h-[215px] rounded-full bg-white border border-slate-200 p-5 shadow-xl shadow-slate-200/30 flex flex-col items-center justify-center text-center z-10"
            >
              {/* Active Item Icon */}
              <div className={`p-3 rounded-2xl border shrink-0 mb-2.5 shadow-sm ${modulesList[activeIdx].bg}`}>
                {modulesList[activeIdx].icon}
              </div>
              <h4 className="text-[12px] font-black text-slate-800 leading-tight mb-1.5 tracking-tight px-1">
                {modulesList[activeIdx].title}
              </h4>
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed px-1">
                {modulesList[activeIdx].desc}
              </p>
              {modulesList[activeIdx].title.includes('IA') && (
                <div className="mt-1 text-[7px] font-black text-purple-600 bg-purple-50 px-2 py-[1.5px] rounded border border-purple-150 uppercase tracking-widest animate-pulse">
                  Assistente Ativo
                </div>
              )}
            </motion.div>

            {/* Radial Orbit items */}
            {modulesList.map((mod, i) => {
              const angle = (i * 2 * Math.PI) / modulesList.length - Math.PI / 2; // offset by -90deg to start from top
              const radius = 145;
              const x = radius * Math.cos(angle);
              const y = radius * Math.sin(angle);
              const isActive = activeIdx === i;

              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => {
                    setActiveIdx(i);
                    setIsOrbitHovered(true);
                  }}
                  className={`absolute w-11 h-11 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-300 shadow-sm ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-700 text-white scale-115 ring-4 ring-indigo-50 z-20' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 z-10 hover:scale-105'
                  }`}
                  style={{
                    left: `calc(50% + ${x}px - 22px)`,
                    top: `calc(50% + ${y}px - 22px)`
                  }}
                >
                  <div className={isActive ? 'text-white [&>svg]:text-white [&>svg]:w-4.5 [&>svg]:h-4.5' : '[&>svg]:w-4.5 [&>svg]:h-4.5'}>
                    {mod.icon}
                  </div>

                  {/* Tiny indicator badge for order/number */}
                  <span className={`absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full text-[8.5px] font-bold flex items-center justify-center border font-mono transition-colors ${
                    isActive ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lower Tagline / Compliance Info */}
        <div className="border-t border-slate-200/70 pt-6 z-10 shrink-0">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-center lg:text-left">
            Sistema de Gestão de Pessoas Christus • SGPC
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: Splendid Login Portal Form */}
      <div className="w-full lg:w-[46%] xl:w-[44%] flex flex-col justify-center items-center px-6 sm:px-12 md:px-16 lg:px-12 xl:px-16 py-12 z-10">
        <div className="w-full max-w-[360px] flex flex-col">
          
          {/* Logo only on mobile */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Users className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 tracking-tight leading-none uppercase">
                SGPC <span className="text-[9px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-md border border-orange-500/20 ml-1 font-extrabold uppercase">RH</span>
              </h2>
            </div>
          </div>

          <div className="space-y-2 mb-8 text-center lg:text-left">
            <div className="hidden lg:inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-650 px-3 py-1 rounded-full border border-indigo-100 text-[9px] font-black tracking-widest uppercase mb-1">
              <Network className="w-3.5 h-3.5 text-indigo-650 shrink-0" />
              <span>Portal Operacional Autorizado</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none">
              Portal de Identidade
            </h1>
            <p className="text-xs sm:text-xs text-slate-450 font-bold leading-relaxed mt-1">
              Acesse usando sua credencial corporativa integrada da Google.
            </p>
          </div>

          {/* Interactive Core Box */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-[28px] space-y-6 shadow-2xl shadow-indigo-950/5 relative">
            
            {/* Split Top Accent */}
            <div className="absolute top-0 left-10 right-10 h-[2px] bg-gradient-to-r from-orange-500/0 via-orange-500/50 to-orange-500/0" />

            <div className="space-y-4">
              <button
                onClick={handleGoogleClick}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-black uppercase tracking-wider py-4 px-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-200/80 disabled:opacity-75 disabled:pointer-events-none"
              >
                {isConnecting ? (
                  <div className="w-4.5 h-4.5 rounded-full border-2 border-slate-800 border-t-transparent animate-spin shrink-0" />
                ) : (
                  <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                )}
                <span>{isConnecting ? 'Conectando...' : 'Entrar com Google'}</span>
              </button>

              {/* Status Badge explaining connection status */}
              <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className={`w-2 h-2 rounded-full ${isFirebaseEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'}`} />
                <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider font-mono">
                  {isFirebaseEnabled ? 'Firestore em tempo real' : 'Ambiente Demonstrativo'}
                </span>
              </div>
            </div>
        </div>

          {/* Security details bottom section */}
          <div className="mt-8 text-center space-y-2">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-center gap-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Conexão Operacional Segura</span>
            </p>
            <p className="text-[9px] text-slate-400 font-medium font-sans leading-relaxed max-w-[280px] mx-auto">
              Privacidade garantida sob padrões corporativos e de acordo com a LGPD.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
