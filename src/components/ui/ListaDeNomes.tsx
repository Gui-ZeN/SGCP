import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SeloBanco } from '../banco/SeloBanco';
import { useBanco } from '../../hooks/useBancoCandidatos';
import { sugestoesDeNome, linhaDaPessoa, formatarTelefone } from '../../utils/bancoCandidatos';

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
  // Sugestões do Banco de candidatos enquanto digita (16/10/2026): a linha em
  // foco e qual sugestão está destacada pelas setas.
  const banco = useBanco();
  const [sugerindo, setSugerindo] = useState<{ linha: number; destaque: number } | null>(null);
  const sugestoes = banco && sugerindo ? sugestoesDeNome(banco.pessoas, linhas[sugerindo.linha] || '') : [];
  const escolher = (i: number, k: number) => {
    const p = sugestoes[k];
    if (!p) return;
    mudar(i, linhaDaPessoa(p));
    setSugerindo(null);
  };
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
            <span className="lista-nomes-campo">
            <input
              ref={el => { campos.current[i] = el; }}
              className="campo"
              value={nome}
              aria-label={`${rotulo} ${i + 1}`}
              placeholder={i === 0 ? 'Nome completo' : ''}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={sugerindo?.linha === i && sugestoes.length > 0}
              aria-controls={`sugestoes-nome-${i}`}
              autoComplete="off"
              onChange={e => { mudar(i, e.target.value); setSugerindo({ linha: i, destaque: -1 }); }}
              onFocus={() => setSugerindo({ linha: i, destaque: -1 })}
              // Clique numa sugestão acontece antes do blur (onMouseDown abaixo).
              onBlur={() => setSugerindo(s => (s?.linha === i ? null : s))}
              onKeyDown={e => {
                const aberta = sugerindo?.linha === i && sugestoes.length > 0;
                if (aberta && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                  e.preventDefault();
                  const n = sugestoes.length, d = sugerindo!.destaque;
                  setSugerindo({ linha: i, destaque: e.key === 'ArrowDown' ? (d + 1) % n : (d <= 0 ? n - 1 : d - 1) });
                  return;
                }
                // Esc fecha só as sugestões: o Modal escuta o Esc no document e
                // fecharia o formulário inteiro com a lista digitada (auditoria, 16/10/2026).
                if (aberta && e.key === 'Escape') { e.preventDefault(); e.nativeEvent.stopPropagation(); setSugerindo(null); return; }
                if (aberta && e.key === 'Enter' && sugerindo!.destaque >= 0) { e.preventDefault(); escolher(i, sugerindo!.destaque); return; }
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
            {sugerindo?.linha === i && sugestoes.length > 0 && (
              <ul id={`sugestoes-nome-${i}`} role="listbox" className="sugestoes-nome" aria-label="Pessoas do banco de candidatos">
                {sugestoes.map((p, k) => {
                  const ult = p.convocacoes[0];
                  return (
                    <li key={p.chave} role="option" aria-selected={sugerindo.destaque === k}
                      onMouseDown={e => { e.preventDefault(); escolher(i, k); }}>
                      <b>{p.nome}</b>{p.telefone && <span> · {formatarTelefone(p.telefone)}</span>}
                      <span className="sub">
                        {banco?.marcaPara(p.nome, p.telefone) && <b style={{ color: 'var(--atraso)' }}>Não chamar · </b>}
                        Chamado {p.vezes}x{ult ? ` · Última: ${ult.cargo ? `${ult.cargo} · ` : ''}${ult.candidato.data}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* Banco de candidatos: "2 convocações · faltou 2x", "Não chamar" — antes do Adicionar. */}
            <SeloBanco nome={nome} />
            </span>
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
