import React, { useState } from 'react';
import { sortearFrase } from '../data/setembroAmarelo';

/**
 * Faixa do Setembro Amarelo no Início — sorteia uma frase a cada abertura do
 * sistema. Enfeite sazonal: o admin liga/desliga no Painel Admin → Enfeites
 * (liga sozinho em setembro).
 */

const LacoAmarelo: React.FC<{ className?: string }> = ({ className }) => (
  // Laço símbolo da campanha (duas alças cruzadas + caudas)
  <svg viewBox="0 0 32 40" className={className} aria-hidden fill="none">
    <path
      d="M16 23 C 6 15, 4 4, 11 3 C 16.5 2.2, 17 12, 16 23 Z"
      fill="#F5B301" stroke="#D99400" strokeWidth="1.2" strokeLinejoin="round"
    />
    <path
      d="M16 23 C 26 15, 28 4, 21 3 C 15.5 2.2, 15 12, 16 23 Z"
      fill="#FFC93C" stroke="#D99400" strokeWidth="1.2" strokeLinejoin="round"
    />
    <path d="M16 22 L 10 37" stroke="#F5B301" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M16 22 L 23 37" stroke="#FFC93C" strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="16" cy="22.5" r="2.4" fill="#D99400" />
  </svg>
);

export const SetembroAmarelo: React.FC = () => {
  // Sorteia UMA vez por montagem: a frase muda a cada vez que o sistema é aberto.
  const [frase] = useState(() => sortearFrase());

  return (
    <section
      aria-label="Setembro Amarelo"
      className="relative overflow-hidden bg-white rounded-3xl border border-amber-200 shadow-sm"
    >
      {/* Fita amarela na borda esquerda */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#FFC93C] to-[#F5B301]" />
      <div className="absolute -top-16 -right-10 w-64 h-64 bg-amber-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-4 px-5 py-4 md:px-6 md:py-5">
        <LacoAmarelo className="w-8 h-10 shrink-0 drop-shadow-sm" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">Setembro Amarelo</span>
            <span className="hidden sm:block h-px flex-1 bg-amber-200/70" />
          </div>
          <p className="text-base md:text-lg font-bold text-slate-800 leading-snug text-balance">
            {frase}
          </p>
        </div>
      </div>
    </section>
  );
};
