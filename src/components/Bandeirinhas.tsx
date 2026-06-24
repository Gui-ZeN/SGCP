import React from 'react';

/**
 * Bandeirinhas de São João (festa junina) — faixa decorativa em SVG: cordão em
 * arco (drapejado) com bandeirinhas triangulares penduradas seguindo a curva,
 * cores vibrantes e um balanço leve. Puro enfeite (aria-hidden / no-print).
 * Some quando acabar o São João: é só tirar <Bandeirinhas /> do App. 🎉
 */
const CORES = ['#E8453C', '#F4B400', '#2E8BC0', '#3DA35D', '#F2711C', '#E0529C', '#9B5DE5'];
const FLAGS_X = [10, 30, 50, 70, 90, 110, 130];
// y do cordão (Bézier M0,5 Q70,39 140,5) num dado x → y = 5 + 68·t·(1−t), t = x/140
const yCordao = (x: number) => { const t = x / 140; return 5 + 68 * t * (1 - t); };

export const Bandeirinhas: React.FC = () => {
  return (
    <div aria-hidden className="w-full bg-white shrink-0 select-none pointer-events-none no-print" style={{ lineHeight: 0 }}>
      <style>{`@keyframes sgpc-sway{0%,100%{transform:translateY(0)}50%{transform:translateY(1.6px)}}`}</style>
      <svg width="100%" height="40" style={{ display: 'block', animation: 'sgpc-sway 4.5s ease-in-out infinite' }}>
        <defs>
          <pattern id="sgpc-bunting" width="140" height="40" patternUnits="userSpaceOnUse">
            <path d="M0,5 Q70,39 140,5" fill="none" stroke="#6b5a3a" strokeWidth="1.8" strokeLinecap="round" />
            {FLAGS_X.map((x, i) => {
              const y = yCordao(x);
              return (
                <g key={i}>
                  <polygon points={`${x - 7.5},${y} ${x + 7.5},${y} ${x},${y + 16}`} fill={CORES[i % CORES.length]} />
                  <circle cx={x} cy={y} r="1.5" fill="#5b4d35" />
                </g>
              );
            })}
          </pattern>
        </defs>
        <rect width="100%" height="40" fill="url(#sgpc-bunting)" />
      </svg>
    </div>
  );
};
