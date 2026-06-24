import React, { useMemo } from 'react';

/**
 * Bandeirinhas de São João (festa junina) — SVG: cordão em arco (drapejado) com
 * bandeirolas de FORMAS variadas (rabo-de-andorinha / triângulo / pendão) penduradas,
 * cada uma FLUTUANDO com atraso escalonado → uma "onda" de vento percorre a faixa.
 * Puro enfeite (aria-hidden / no-print). Some tirando <Bandeirinhas /> do App. 🎉
 */
const CORES = ['#E8453C', '#F4B400', '#2E8BC0', '#3DA35D', '#F2711C', '#E0529C', '#9B5DE5'];

// Três formas, ancoradas no topo-centro (0,0), penduradas para baixo:
const FORMAS = [
  '-9,0 9,0 9,20 0,13 -9,20', // rabo-de-andorinha (entalhe no rodapé)
  '-9,0 9,0 0,22',            // triângulo
  '-7.5,0 7.5,0 4.5,21 -4.5,21', // pendão (afunilado)
];

const PERIODO = 156;   // largura de um arco do cordão
const AMP = 9;         // o quanto o cordão "cava"
const BASE = 5;        // y do cordão nas pontas do arco
const TOTAL = 2800;    // largura coberta (sobra recortada em telas menores)
const ESPACO = 26;     // distância entre bandeirinhas
const yCordao = (x: number) => BASE + AMP * Math.sin(Math.PI * ((x % PERIODO) / PERIODO));

export const Bandeirinhas: React.FC = () => {
  const { path, flags } = useMemo(() => {
    let d = `M0,${yCordao(0).toFixed(1)}`;
    for (let x = 8; x <= TOTAL; x += 8) d += ` L${x},${yCordao(x).toFixed(1)}`;
    const fs: { x: number; y: number; i: number }[] = [];
    for (let x = 16, i = 0; x <= TOTAL; x += ESPACO, i++) fs.push({ x, y: yCordao(x), i });
    return { path: d, flags: fs };
  }, []);

  return (
    <div aria-hidden className="w-full bg-white shrink-0 select-none pointer-events-none no-print" style={{ lineHeight: 0 }}>
      <style>{`
        .sgpc-flag{transform-box:fill-box;transform-origin:50% 0;animation:sgpc-flutter 2.6s ease-in-out infinite}
        @keyframes sgpc-flutter{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
        @media (prefers-reduced-motion: reduce){.sgpc-flag{animation:none}}
      `}</style>
      <svg width="100%" height="40" style={{ display: 'block' }}>
        <path d={path} fill="none" stroke="#6b5a3a" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {flags.map(({ x, y, i }) => (
          <g key={i} transform={`translate(${x},${y.toFixed(1)})`}>
            <g className="sgpc-flag" style={{ animationDelay: `${(i % 22) * -0.1}s` }}>
              <polygon points={FORMAS[i % FORMAS.length]} fill={CORES[i % CORES.length]} />
            </g>
            <circle r="1.4" fill="#5b4d35" />
          </g>
        ))}
      </svg>
    </div>
  );
};
