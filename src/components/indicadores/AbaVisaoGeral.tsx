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
 *
 * Rework 10/2026: cada pendência leva também à tela onde ela se RESOLVE
 * (`resolver`) — o detalhe do número fica na aba; a ação, no módulo.
 */
import React from 'react';
import { AlertTriangle, Clock, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';

export type AbaId = 'geral' | 'vagas' | 'selecoes' | 'pessoas' | 'absenteismo' | 'clima';

export interface ItemDeAtencao {
  id: string;
  gravidade: 'critico' | 'atencao';
  texto: string;
  detalhe?: string;
  aba: AbaId;
  /** A tela onde se resolve: rótulo curto + link. */
  resolver?: { rotulo: string; href: string };
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
  <div className="space-y-5">
    <section aria-labelledby="vg-atencao" className="painel">
      <header className="inicio-cab">
        <h2 id="vg-atencao">Precisa de atenção</h2>
      </header>
      {atencao.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-5 text-[14px] font-medium" style={{ color: 'var(--tinta-2)' }}>
          <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--etapa-admissao)' }} aria-hidden="true" />
          Nada pendente com os filtros escolhidos.
        </p>
      ) : (
        <ul className="ind-atencao">
          {atencao.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => irPara(a.aba)} className="ind-atencao-item" title="Ver o detalhe nesta tela">
                {a.gravidade === 'critico'
                  ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--atraso)' }} aria-label="Crítico" />
                  : <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--etapa-triagem)' }} aria-label="Atenção" />}
                <span className="min-w-0 flex-1">
                  <b>{a.texto}</b>
                  {a.detalhe && <span>{a.detalhe}</span>}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 ind-seta" aria-hidden="true" />
              </button>
              {a.resolver && (
                <a href={a.resolver.href} className="btn btn-sm shrink-0">
                  {a.resolver.rotulo} <ArrowRight aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {temas.map(t => (
        <button key={t.aba} type="button" onClick={() => irPara(t.aba)} className="painel ind-tema">
          <span className="ind-tema-titulo">
            {t.titulo}
            <ChevronRight className="w-4 h-4 ind-seta" aria-hidden="true" />
          </span>
          <span className="ind-tema-valor">{t.principal.valor}</span>
          <span className="ind-tema-rotulo">{t.principal.rotulo}</span>
          <span className="ind-tema-apoio">
            {t.apoio.map(a => (
              <span key={a.rotulo} className="min-w-0">
                <b>{a.valor}</b>
                <span>{a.rotulo}</span>
              </span>
            ))}
          </span>
        </button>
      ))}
    </div>
  </div>
);
