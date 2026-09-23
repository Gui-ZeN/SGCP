/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Visão geral para o RH do dia a dia: primeiro o que PRECISA DE AÇÃO, com o
 * número e o caminho até ele; depois um resumo por tema.
 *
 * Substitui os "Destaques Operacionais" antigos, que geravam frases genéricas
 * ("Indicadores estáveis… operam em níveis saudáveis") — texto que parece
 * análise e não diz o que fazer.
 */
import React from 'react';
import { AlertTriangle, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';

export type AbaId = 'geral' | 'vagas' | 'selecoes' | 'pessoas' | 'clima';

export interface ItemDeAtencao {
  id: string;
  gravidade: 'critico' | 'atencao';
  texto: string;
  detalhe?: string;
  aba: AbaId;
}

export interface ResumoDoTema {
  aba: AbaId;
  titulo: string;
  principal: { valor: string; rotulo: string };
  apoio: { valor: string; rotulo: string }[];
}

export const AbaVisaoGeral: React.FC<{
  atencao: ItemDeAtencao[];
  temas: ResumoDoTema[];
  irPara: (aba: AbaId) => void;
}> = ({ atencao, temas, irPara }) => (
  <div className="space-y-6">
    <section aria-labelledby="vg-atencao" className="bg-white rounded-2xl border border-slate-200">
      <header className="px-5 pt-4 pb-3 border-b border-slate-100">
        <h3 id="vg-atencao" className="text-sm font-bold text-slate-900">Precisa de atenção</h3>
      </header>
      {atencao.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-5 text-sm font-medium text-slate-600">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          Nada pendente com os filtros escolhidos.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {atencao.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => irPara(a.aba)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 cursor-pointer transition-colors group">
                {a.gravidade === 'critico'
                  ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" aria-label="Crítico" />
                  : <Clock className="w-4 h-4 shrink-0 text-amber-600" aria-label="Atenção" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{a.texto}</span>
                  {a.detalhe && <span className="block text-xs text-slate-500 font-medium mt-0.5 truncate">{a.detalhe}</span>}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {temas.map(t => (
        <button key={t.aba} type="button" onClick={() => irPara(t.aba)}
          className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-400 cursor-pointer transition-colors group min-w-0">
          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
            {t.titulo}
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
          </span>
          <span className="block mt-2 text-[32px] leading-none font-bold tabular-nums tracking-tight text-slate-900">{t.principal.valor}</span>
          <span className="block mt-1 text-xs font-medium text-slate-500">{t.principal.rotulo}</span>
          <span className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
            {t.apoio.map(a => (
              <span key={a.rotulo} className="min-w-0">
                <span className="block text-base font-bold tabular-nums text-slate-900">{a.valor}</span>
                <span className="block text-[11px] font-medium text-slate-500 leading-snug">{a.rotulo}</span>
              </span>
            ))}
          </span>
        </button>
      ))}
    </div>
  </div>
);

