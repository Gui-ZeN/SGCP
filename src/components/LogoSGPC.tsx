import React from 'react';

/**
 * Logo SGPC — monograma em grade 2×2, com a célula do "C" no acento do tema.
 *
 * É inline (não <img src="logo.svg">) de propósito: assim a cor vem dos tokens
 * (--sgpc-acento / --sgpc-tinta) e a logo acompanha automaticamente qualquer
 * campanha ou tema. Bônus: dentro da página o SVG usa a Hanken Grotesk de
 * verdade — via <img> a fonte não carrega e caía no Arial.
 */
export const LogoSGPC: React.FC<{ className?: string; title?: string }> = ({
  className,
  title = 'SGPC',
}) => (
  <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title}>
    <title>{title}</title>
    {/* célula do C — o acento do sistema */}
    <rect x="50" y="50" width="42" height="42" fill="var(--sgpc-acento, #1B4DD8)" />
    <g fill="none" stroke="var(--sgpc-tinta, #17181B)" strokeWidth="3">
      <rect x="8" y="8" width="84" height="84" />
      <line x1="50" y1="8" x2="50" y2="92" />
      <line x1="8" y1="50" x2="92" y2="50" />
    </g>
    <g
      fontFamily="'Hanken Grotesk', system-ui, sans-serif"
      fontWeight="800"
      fontSize="30"
      textAnchor="middle"
    >
      <text x="29" y="29" fill="var(--sgpc-tinta, #17181B)" dominantBaseline="central">S</text>
      <text x="71" y="29" fill="var(--sgpc-tinta, #17181B)" dominantBaseline="central">G</text>
      <text x="29" y="71" fill="var(--sgpc-tinta, #17181B)" dominantBaseline="central">P</text>
      <text x="71" y="71" fill="var(--sgpc-papel, #FFFFFF)" dominantBaseline="central">C</text>
    </g>
  </svg>
);
