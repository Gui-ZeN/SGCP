import React from 'react';

/**
 * Bandeirinhas de São João (festa junina) — faixa decorativa de bandeirinhas
 * triangulares coloridas penduradas num cordão. Puramente enfeite (aria-hidden).
 * Cores inline (não dependem do tema). Trocar/remover quando acabar o São João. 🎉
 */
const CORES = ['#E63329', '#F2B705', '#1356C2', '#2E9E4F', '#E8702A', '#E84393'];

export const Bandeirinhas: React.FC<{ quantidade?: number }> = ({ quantidade = 120 }) => {
  return (
    <div
      aria-hidden
      className="relative w-full bg-white shrink-0 select-none pointer-events-none overflow-hidden no-print"
      style={{ height: 17 }}
    >
      {/* cordão */}
      <div className="absolute left-0 right-0" style={{ top: 2, height: 2, background: 'rgba(20,27,45,0.30)' }} />
      {/* bandeirinhas (triângulos apontando para baixo) */}
      <div className="absolute left-0 right-0 flex justify-center" style={{ top: 3 }}>
        {Array.from({ length: quantidade }).map((_, i) => (
          <span
            key={i}
            style={{
              margin: '0 3.5px',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `13px solid ${CORES[i % CORES.length]}`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
