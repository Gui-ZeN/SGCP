import { useSyncExternalStore } from 'react';

/**
 * Tema visual ativo, lido do atributo `data-theme` da raiz (<html>).
 * Reativo: qualquer componente que use este hook re-renderiza quando o tema
 * troca (o App alterna o atributo), sem precisar receber prop. Útil para
 * coisas que não dão pra re-skinar via CSS — ex.: paleta de gráficos (canvas/SVG).
 */
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function getSnapshot(): string {
  return document.documentElement.getAttribute('data-theme') || 'atual';
}

export function useTheme(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'atual');
}
