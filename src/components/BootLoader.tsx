import React, { useEffect, useState } from 'react';

/**
 * Loader de boot com a identidade do SGPC: o monograma em grade 2×2 (a logo)
 * com as letras "acendendo" em onda (S→G→P→C), e micro-frases de RH que trocam
 * embaixo. Substitui o spinner genérico. Honra prefers-reduced-motion.
 */
const MENSAGENS = [
  'Abrindo o quadro de vagas…',
  'Conferindo os SLAs…',
  'Organizando o funil de candidatos…',
  'Preparando os indicadores…',
  'Alinhando as etapas de admissão…',
];

export const BootLoader: React.FC = () => {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MENSAGENS.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center gap-5">
      <style>{`
        @keyframes sgpc-boot-wave{0%,55%,100%{opacity:.18}12%,32%{opacity:1}}
        .sgpc-boot-letra{animation:sgpc-boot-wave 1.7s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.sgpc-boot-letra{animation:none;opacity:1}}
      `}</style>

      {/* Monograma 2×2 (grade da logo); a célula do C é cobalto, como na marca */}
      <div aria-hidden className="grid grid-cols-2 gap-[2px] bg-slate-900 p-[2px] rounded-lg shadow-sm" style={{ width: 76, height: 76 }}>
        {(['S', 'G', 'P', 'C'] as const).map((letra, i) => (
          <div key={letra} className={`flex items-center justify-center text-xl font-black ${letra === 'C' ? 'bg-[#1B4DD8] text-white' : 'bg-white text-slate-900'}`}>
            <span className="sgpc-boot-letra" style={{ animationDelay: `${i * 0.22}s` }}>{letra}</span>
          </div>
        ))}
      </div>

      <div role="status" aria-live="polite" className="h-5 text-sm font-semibold text-slate-500 tracking-wide">
        {MENSAGENS[msgIdx]}
      </div>
    </div>
  );
};
