/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';

/**
 * Alternativa textual/tabular de um gráfico.
 *
 * Existe porque os gráficos do dashboard eram SVG puro: sem `role`, sem
 * `aria-label` e sem nenhuma leitura possível para quem não enxerga a figura —
 * o valor só existia no desenho e no tooltip. As Web Interface Guidelines, que
 * este projeto já segue, e a regra de visualização de dados pedem que todo
 * gráfico tenha um par tabular; um tooltip não serve, porque exige apontar.
 *
 * Fica fechada por padrão (`<details>`), então não muda a densidade da tela
 * para quem lê o gráfico, e abre no mesmo lugar para quem precisa do número.
 * Na impressão do PDF ela é ocultada — a capa e os gráficos já vão no papel.
 */

export interface ColunaGrafico<T> {
  /** Cabeçalho da coluna. */
  titulo: string;
  /** Valor da célula. */
  valor: (linha: T) => React.ReactNode;
  /** Alinha à direita e aplica números tabulares (colunas numéricas). */
  numerica?: boolean;
}

interface TabelaDoGraficoProps<T> {
  /** Nome do gráfico — vira a legenda da tabela, lida pelo leitor de tela. */
  titulo: string;
  linhas: T[];
  colunas: ColunaGrafico<T>[];
  /** Texto do resumo quando fechada. Default: "Ver dados em tabela". */
  rotulo?: string;
}

export function TabelaDoGrafico<T>({ titulo, linhas, colunas, rotulo = 'Ver dados em tabela' }: TabelaDoGraficoProps<T>) {
  const idLegenda = useId();
  if (!linhas.length) return null;

  return (
    <details className="no-print mt-3 group/tab">
      <summary
        className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sgpc-acento,#1B4DD8)] rounded transition"
      >
        <span aria-hidden="true" className="inline-block mr-1 transition-transform group-open/tab:rotate-90">›</span>
        {rotulo}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left border-collapse" aria-describedby={idLegenda}>
          <caption id={idLegenda} className="sr-only">{titulo} — dados em tabela</caption>
          <thead>
            <tr className="border-b border-[var(--sgpc-hairline,#DDE0E6)]">
              {colunas.map(c => (
                <th
                  key={c.titulo}
                  scope="col"
                  className={`py-1.5 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${c.numerica ? 'text-right pr-0' : ''}`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, i) => (
              <tr key={i} className="border-b border-[var(--sgpc-hairline,#DDE0E6)] last:border-0">
                {colunas.map(c => (
                  <td
                    key={c.titulo}
                    className={`py-1.5 pr-3 text-[11px] text-slate-600 ${c.numerica ? 'text-right pr-0 tabular-nums font-semibold text-slate-800' : 'font-medium'}`}
                  >
                    {c.valor(linha)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
