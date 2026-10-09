import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * O modal padrão do SGPC (rework 10/2026): abre NO MEIO da tela, por cima de
 * um fundo escurecido. Fecha no X, no Esc e clicando fora. O corpo rola por
 * dentro e o rodapé (ações) fica sempre à vista.
 *
 * Substitui a gaveta lateral e, aos poucos, os modais montados à mão em cada
 * tela — cada um tinha o seu fundo, o seu X e o seu jeito de fechar.
 */
interface Props {
  titulo: ReactNode;
  /** Linha acima do título: número, situação. */
  antes?: ReactNode;
  aoFechar: () => void;
  /** Ações, alinhadas à direita. */
  rodape?: ReactNode;
  largura?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const LARGURA = { sm: 440, md: 640, lg: 860 };

// Modais abertos, do de baixo para o de cima: o Esc fecha só o de cima
// (editar aberto por cima dos detalhes não pode levar os detalhes junto).
const pilha: object[] = [];

export function Modal({ titulo, antes, aoFechar, rodape, largura = 'md', children }: Props) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    const eu = {};
    pilha.push(eu);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && pilha[pilha.length - 1] === eu) fechar.current(); };
    document.addEventListener('keydown', esc);
    // A página de trás não rola enquanto o modal está aberto.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      pilha.splice(pilha.indexOf(eu), 1);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="modal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div
        ref={caixa}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        style={{ maxWidth: LARGURA[largura] }}
      >
        <header className="modal-cab">
          <div className="min-w-0">
            {antes && <div className="modal-antes">{antes}</div>}
            <h2 id={idTitulo} className="modal-titulo">{titulo}</h2>
          </div>
          <button type="button" className="modal-fechar" onClick={aoFechar} aria-label="Fechar"><X /></button>
        </header>
        <div className="modal-corpo">{children}</div>
        {rodape && <footer className="modal-rodape">{rodape}</footer>}
      </div>
    </div>,
    document.body
  );
}
