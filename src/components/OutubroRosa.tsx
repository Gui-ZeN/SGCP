import React, { useState } from 'react';
import { sortearFraseOutubro } from '../data/outubroRosa';

/**
 * Faixa do Outubro Rosa no Início — sorteia uma frase a cada abertura do
 * sistema. Enfeite sazonal: o admin liga/desliga no Painel Admin → Enfeites
 * (liga sozinho em outubro).
 *
 * Desenhada já pelo DESIGN.md: painel de papel com fio, o laço como único
 * elemento de cor própria, e o nome da campanha DEPOIS da frase (sem rótulo em
 * caixa alta acima). O laço usa o rosa tradicional da campanha, mais claro que
 * o acento: ele é símbolo, não estado, então não disputa com o vermelho de erro.
 */

const LacoRosa: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 40" className={className} aria-hidden fill="none">
    <path d="M16 23 C 6 15, 4 4, 11 3 C 16.5 2.2, 17 12, 16 23 Z"
      fill="#EC4899" stroke="#BE185D" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M16 23 C 26 15, 28 4, 21 3 C 15.5 2.2, 15 12, 16 23 Z"
      fill="#F472B6" stroke="#BE185D" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M16 22 L 10 37" stroke="#EC4899" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M16 22 L 23 37" stroke="#F472B6" strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="16" cy="22.5" r="2.4" fill="#BE185D" />
  </svg>
);

export const OutubroRosa: React.FC = () => {
  // Sorteia UMA vez por montagem: a frase muda a cada vez que o sistema é aberto.
  const [frase] = useState(() => sortearFraseOutubro());

  return (
    <section aria-label="Outubro Rosa" className="bg-white rounded-2xl border border-slate-200 flex items-center gap-4 px-5 py-4 md:px-6">
      <LacoRosa className="w-8 h-10 shrink-0" />
      <div className="min-w-0">
        <p className="text-base md:text-lg font-bold text-slate-900 leading-snug [text-wrap:balance]">{frase}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">Outubro Rosa · mês de conscientização sobre o câncer de mama</p>
      </div>
    </section>
  );
};
