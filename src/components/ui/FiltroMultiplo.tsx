import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * Filtro de múltipla escolha — o padrão do SGPC desde 08/10/2026 (pedido do
 * Guilherme: todo filtro aceita várias opções). Nada marcado = todas.
 */
interface Props {
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  /** Como chamar "nada marcado" ("todas", "todos"). */
  todos?: string;
}

export function FiltroMultiplo({ rotulo, opcoes, selecionados, onChange, todos = 'todos' }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const idPainel = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  const marcados = new Set(selecionados);
  // Os nomes, não "2 marcados": quem olha precisa saber O QUE está filtrado.
  const nomes = selecionados.map(v => opcoes.find(o => o.valor === v)?.rotulo ?? v);
  const resumo = nomes.length === 0 ? todos : nomes.length <= 2 ? nomes.join(', ') : `${nomes[0]} +${nomes.length - 1}`;
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? opcoes.filter(o => o.rotulo.toLowerCase().includes(termo)) : opcoes;
  const alternar = (valor: string) =>
    onChange(marcados.has(valor) ? selecionados.filter(v => v !== valor) : [...selecionados, valor]);

  return (
    <div className="filtro-multiplo" ref={raiz}>
      <button
        type="button"
        className="chip"
        aria-pressed={selecionados.length > 0}
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto(a => !a)}
      >
        {rotulo}: <b>{resumo}</b>
        <ChevronDown aria-hidden="true" className="w-4 h-4" />
      </button>
      {aberto && (
        <div className="filtro-painel" id={idPainel} role="group" aria-label={rotulo}>
          {opcoes.length > 8 && (
            <label className="filtro-busca">
              <Search aria-hidden="true" />
              <input autoFocus type="search" placeholder={`Buscar ${rotulo.toLowerCase()}`} value={busca} onChange={e => setBusca(e.target.value)} aria-label={`Buscar ${rotulo.toLowerCase()}`} />
            </label>
          )}
          <div className="filtro-opcoes">
            {visiveis.length === 0 && <p className="filtro-nada">Nada encontrado.</p>}
            {visiveis.map(o => (
              <label key={o.valor}>
                <input type="checkbox" checked={marcados.has(o.valor)} onChange={() => alternar(o.valor)} />
                <span>{o.rotulo}</span>
              </label>
            ))}
          </div>
          <div className="filtro-rodape">
            <span>{selecionados.length ? `${selecionados.length} de ${opcoes.length}` : `Mostrando ${todos}`}</span>
            <button type="button" className="btn-texto" onClick={() => onChange([])} disabled={!selecionados.length}>Limpar</button>
          </div>
        </div>
      )}
    </div>
  );
}
