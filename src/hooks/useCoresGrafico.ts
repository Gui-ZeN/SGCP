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
  // Chrome do gráfico: eixo, grade e rótulo. Sem estes, o dashboard voltava a
  // hexadecimal chumbado — as séries seguiam a campanha e os eixos não.
  rotulo: '--sgpc-tinta-secundaria',
  eixo: '--sgpc-tinta-suave',
  grade: '--sgpc-hairline',
} as const;

// Fallbacks = os valores que a paleta usava antes, caso o token não resolva
// (ex.: CSS ainda não aplicado no primeiro paint).
const FALLBACK = {
  primary: '#1B4DD8',
  emerald: '#1F9D6B',
  amber: '#D99500',
  rose: '#DC4448',
  slate: '#9CA0A8',
  rotulo: '#45474D',
  eixo: '#5F6169',
  grade: '#DDE0E6',
} as const;

export interface CoresGrafico {
  primary: string;
  emerald: string;
  amber: string;
  rose: string;
  slate: string;
  /** Cor do rótulo de valor desenhado junto à marca (LabelList). */
  rotulo: string;
  /** Cor dos ticks e da linha de eixo. */
  eixo: string;
  /** Cor da grade — hairline, uma nota acima da superfície. */
  grade: string;
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
    rotulo: ler(TOKENS.rotulo, FALLBACK.rotulo),
    eixo: ler(TOKENS.eixo, FALLBACK.eixo),
    grade: ler(TOKENS.grade, FALLBACK.grade),
  };
  cache = { chave, cores };
  return cores;
}

export function useCoresGrafico(): CoresGrafico {
  return useSyncExternalStore(subscribe, getSnapshot, () => FALLBACK);
}
