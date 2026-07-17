import { lazy, ComponentType } from 'react';

/**
 * Recuperação de deploy para code-splitting.
 *
 * Problema: os chunks têm hash no nome (Secao-a1b2c3.js). Num deploy novo os
 * hashes mudam e os antigos somem. Quem estava com a aba aberta (index.html
 * velho) clica numa aba lazy → o import() busca o chunk velho → 404 → o React
 * desmonta a árvore → TELA BRANCA.
 *
 * Solução: se o import falhar por chunk sumido, recarrega a página UMA vez —
 * a recarga traz o index.html novo com os hashes corretos. O guard em
 * sessionStorage evita loop infinito se a falha for outra (ex.: rede fora).
 */

const FLAG_RELOAD = 'sgcp_reload_chunk';

/** É falha de carregamento de chunk (deploy trocou os hashes)? */
export function ehErroDeChunk(erro: unknown): boolean {
  const msg = String((erro as any)?.message ?? erro ?? '');
  const nome = String((erro as any)?.name ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg) ||
    nome === 'ChunkLoadError'
  );
}

/** Recarrega a página uma única vez (protegido contra loop). Retorna se recarregou. */
export function recarregarUmaVez(): boolean {
  try {
    if (sessionStorage.getItem(FLAG_RELOAD)) return false;
    sessionStorage.setItem(FLAG_RELOAD, '1');
  } catch (e) {
    // sem sessionStorage: recarrega mesmo assim (melhor que tela branca)
  }
  window.location.reload();
  return true;
}

/** Limpa o guard depois que algo carregou com sucesso. */
export function limparGuardDeReload(): void {
  try { sessionStorage.removeItem(FLAG_RELOAD); } catch (e) {}
}

/** Igual ao React.lazy, mas se recupera de chunk sumido após deploy. */
export function lazyComRetry<T extends ComponentType<any>>(
  carregar: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await carregar();
      limparGuardDeReload(); // carregou: libera o guard p/ o próximo deploy
      return mod;
    } catch (erro) {
      if (ehErroDeChunk(erro) && recarregarUmaVez()) {
        // A página está recarregando: nunca resolve (evita piscar erro antes do reload).
        return new Promise<{ default: T }>(() => {});
      }
      throw erro; // erro real → cai no ErrorBoundary com mensagem amigável
    }
  });
}
