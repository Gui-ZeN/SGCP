import { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * Um campo por nome, e "+ Adicionar nome" abre a próxima linha (pedido do
 * Guilherme, 08/10/2026: "nome por linha" num campo só, elas iam errar).
 * Enter também abre a próxima. Colar uma lista de vários nomes de uma vez
 * ainda funciona: cada linha colada vira um campo.
 *
 * O valor inclui as linhas em branco (para o campo novo aparecer); quem usa
 * pega os nomes com `nomesPreenchidos`.
 */
export const nomesPreenchidos = (lista: string[]) => lista.map(n => n.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Texto colado com um nome por linha → os nomes (linha vazia e espaço sobrando não viram candidato). */
export const nomesDoTexto = (texto: string): string[] => nomesPreenchidos(texto.split(/\r?\n/));

export function ListaDeNomes({ nomes, onChange, rotulo = 'Nome' }: {
  nomes: string[];
  onChange: (nomes: string[]) => void;
  rotulo?: string;
}) {
  const linhas = nomes.length ? nomes : [''];
  const campos = useRef<(HTMLInputElement | null)[]>([]);
  const focar = useRef<number | null>(null);

  // Depois de abrir uma linha, o cursor já vai para ela.
  useEffect(() => {
    if (focar.current !== null) { campos.current[focar.current]?.focus(); focar.current = null; }
  });

  const mudar = (i: number, valor: string) => onChange(linhas.map((n, j) => (j === i ? valor : n)));
  const abrirLinha = (depois: number) => {
    focar.current = depois + 1;
    onChange([...linhas.slice(0, depois + 1), '', ...linhas.slice(depois + 1)]);
  };
  const remover = (i: number) => {
    const resto = linhas.filter((_, j) => j !== i);
    focar.current = Math.max(0, i - 1);
    onChange(resto.length ? resto : ['']);
  };

  return (
    <div className="lista-nomes">
      <ol>
        {linhas.map((nome, i) => (
          <li key={i}>
            <span className="lista-nomes-n" aria-hidden="true">{i + 1}</span>
            <input
              ref={el => { campos.current[i] = el; }}
              className="campo"
              value={nome}
              aria-label={`${rotulo} ${i + 1}`}
              placeholder={i === 0 ? 'Nome completo' : ''}
              onChange={e => mudar(i, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (i === linhas.length - 1) { if (nome.trim()) abrirLinha(i); }
                  else campos.current[i + 1]?.focus();
                }
                if (e.key === 'Backspace' && !nome && linhas.length > 1) { e.preventDefault(); remover(i); }
              }}
              onPaste={e => {
                const colado = e.clipboardData.getData('text');
                const varios = nomesDoTexto(colado);
                if (varios.length < 2) return;
                e.preventDefault();
                focar.current = i + varios.length - 1;
                onChange([...linhas.slice(0, i), ...varios, ...linhas.slice(i + 1)]);
              }}
            />
            {linhas.length > 1 && (
              <button type="button" className="lista-nomes-x" onClick={() => remover(i)} aria-label={`Remover ${nome || `a linha ${i + 1}`}`}>
                <X />
              </button>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => abrirLinha(linhas.length - 1)}>
        <Plus />Adicionar nome
      </button>
    </div>
  );
}
