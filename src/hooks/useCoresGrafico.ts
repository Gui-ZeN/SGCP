import { useSyncExternalStore } from 'react';

/**
 * Paleta dos gráficos lida dos DESIGN TOKENS em runtime.
 *
 * Por que não passar `var(--sgpc-acento)` direto pro recharts: a lib repassa a
 * cor tanto para atributos SVG (onde var() funciona) quanto para JS/inline style
 * de tooltips e legendas — resolver aqui devolve um HEX de verdade e evita
 * qualquer canto onde var() não seria interpretado.
 *
 * Reativo: observa `data-theme` e `data-campanha` na raiz, então trocar a
 * campanha repinta os gráficos junto com o resto do sistema.
 */

const TOKENS = {
  primary: '--sgpc-acento',
  emerald: '--sgpc-sucesso',
  amber: '--sgpc-alerta',
  rose: '--sgpc-erro',
} as const;

// Fallbacks = os valores que a paleta usava antes, caso o token não resolva
// (ex.: CSS ainda não aplicado no primeiro paint).
const FALLBACK = {
  primary: '#1B4DD8',
  emerald: '#1F9D6B',
  amber: '#D99500',
  rose: '#DC4448',
  slate: '#9CA0A8',
} as const;

export interface CoresGrafico {
  primary: string;
  emerald: string;
  amber: string;
  rose: string;
  slate: string;
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-campanha'],
  });
  return () => observer.disconnect();
}

// useSyncExternalStore exige snapshot estável: só recalcula quando a chave muda.
let cache: { chave: string; cores: CoresGrafico } | null = null;

function getSnapshot(): CoresGrafico {
  const raiz = document.documentElement;
  const chave = `${raiz.getAttribute('data-theme')}|${raiz.getAttribute('data-campanha')}`;
  if (cache && cache.chave === chave) return cache.cores;

  const estilo = getComputedStyle(raiz);
  const ler = (token: string, padrao: string) => estilo.getPropertyValue(token).trim() || padrao;

  const cores: CoresGrafico = {
    primary: ler(TOKENS.primary, FALLBACK.primary),
    emerald: ler(TOKENS.emerald, FALLBACK.emerald),
    amber: ler(TOKENS.amber, FALLBACK.amber),
    rose: ler(TOKENS.rose, FALLBACK.rose),
    slate: FALLBACK.slate, // neutro: não é semântico nem acento
  };
  cache = { chave, cores };
  return cores;
}

export function useCoresGrafico(): CoresGrafico {
  return useSyncExternalStore(subscribe, getSnapshot, () => FALLBACK);
}
