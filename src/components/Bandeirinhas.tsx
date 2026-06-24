import React, { useMemo } from 'react';

/**
 * Bandeirinhas de São João (festa junina) — overlay que DRAPEJA por cima do topo
 * (na frente da logo/nome, não como faixa separada). SVG com cordão de corda em arco
 * e bandeirolas de formas variadas (rabo-de-andorinha / triângulo / pendão), com
 * brilho+dobra no tecido (mais realista) e flutuação em onda (atraso escalonado).
 * Puro enfeite: aria-hidden, pointer-events-none, no-print. Some tirando <Bandeirinhas/>. 🎉
 */
const CORES = ['#E8453C', '#F4B400', '#2E8BC0', '#3DA35D', '#F2711C', '#E0529C', '#9B5DE5'];
const FORMAS = [
  '-9,0 9,0 9,21 0,13 -9,21',     // rabo-de-andorinha
  '-9,0 9,0 0,23',                // triângulo
  '-7.5,0 7.5,0 4.5,22 -4.5,22',  // pendão
];
const FUNDOS = [13, 23, 22]; // y do "fundo" de cada forma (p/ a linha de dobra)

const PERIODO = 158, AMP = 9, BASE = 6, TOTAL = 2800, ESPACO = 27;
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
    <div aria-hidden className="absolute top-0 left-0 right-0 z-40 pointer-events-none no-print" style={{ lineHeight: 0 }}>
      <style>{`
        .sgpc-flag{transform-box:fill-box;transform-origin:50% 0;animation:sgpc-flutter 2.7s ease-in-out infinite}
        @keyframes sgpc-flutter{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
        @media (prefers-reduced-motion: reduce){.sgpc-flag{animation:none}}
      `}</style>
      <svg width="100%" height="46" style={{ display: 'block' }}>
        <defs>
          {/* brilho do tecido: claro no topo, sombra embaixo (dá volume) */}
          <linearGradient id="sgpc-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.40" />
            <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="#7a5230" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {flags.map(({ x, y, i }) => {
          const forma = FORMAS[i % FORMAS.length];
          return (
            <g key={i} transform={`translate(${x},${y.toFixed(1)})`}>
              <g className="sgpc-flag" style={{ animationDelay: `${(i % 22) * -0.1}s` }}>
                <polygon points={forma} fill={CORES[i % CORES.length]} />
                <polygon points={forma} fill="url(#sgpc-sheen)" />
                <line x1="0" y1="1.5" x2="0" y2={FUNDOS[i % FORMAS.length] - 2} stroke="#000" strokeOpacity="0.10" strokeWidth="1" />
              </g>
              <circle r="1.5" fill="#5b3f22" />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
