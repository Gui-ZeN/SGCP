/**
 * O funil da seleção até a experiência (29/09/2026), no formato de funil da
 * referência do Guilherme — etapa à esquerda, volume e conversão no centro,
 * perda à direita — mas no tema Suíço (DESIGN.md): um azul, chapado.
 *
 * Duas escolhas de honestidade:
 *  - a LARGURA de cada faixa segue o número (raiz quadrada, para 54 ao lado de
 *    1.309 ainda aparecer), em vez do afunilamento decorativo da referência;
 *  - à direita, vermelho só para perda de verdade (não compareceu, saiu na
 *    experiência). A diferença entre aprovado, documentação e contratado é de
 *    vagas AINDA em andamento — aparece em cinza, como "em andamento".
 */
import React from 'react';
import type { FunilCompleto as Funil, EtapaFunil } from '../../utils/funil';
import { TabelaDoGrafico } from '../TabelaDoGrafico';
import { Painel, Nota, num, pct } from './ui';

const DESCRICAO: Record<EtapaFunil['id'], string> = {
  chamados: 'Convocados nas seleções',
  compareceram: 'Vieram no dia',
  aprovados: 'Vaga com aprovado escolhido',
  documentacao: 'Vaga que chegou à documentação',
  contratados: 'Vaga fechada no período',
  efetivados: 'Aprovado efetivado na Experiência',
};

/** Largura relativa da faixa (0–1): raiz do valor, com piso para caber o número. */
const largura = (v: number, max: number) => Math.max(0.2, Math.sqrt(v / max));

/**
 * Escala sequencial da cor do sistema (segue a campanha): clara nas etapas de
 * volume, cheia no resultado. Texto em tinta onde o fundo é claro, branco onde
 * é cheio — nos dois casos acima de 4,5:1.
 */
const mistura = (p: number) => `color-mix(in oklab, var(--sgpc-acento) ${p}%, var(--sgpc-papel))`;
const TONS: { fundo: string; texto: string }[] = [
  { fundo: mistura(18), texto: 'var(--sgpc-tinta)' },
  { fundo: mistura(30), texto: 'var(--sgpc-tinta)' },
  { fundo: mistura(44), texto: 'var(--sgpc-tinta)' },
  { fundo: mistura(58), texto: 'var(--sgpc-tinta)' },
  { fundo: 'var(--sgpc-acento)', texto: 'var(--sgpc-papel)' },
  { fundo: 'var(--sgpc-acento-forte)', texto: 'var(--sgpc-papel)' },
];

interface Saida { destaque: string; texto: string; perda: boolean }

export const FunilCompleto: React.FC<{ funil: Funil; recorteRotulo: string }> = ({ funil, recorteRotulo }) => {
  const { etapas, experiencia } = funil;
  const max = Math.max(1, ...etapas.map(e => e.valor));
  const concluiram = experiencia.efetivados + experiencia.sairam;
  const valor = (id: EtapaFunil['id']) => etapas.find(e => e.id === id)!.valor;

  // Conversão para a etapa anterior. Entre compareceram e aprovados muda a
  // fonte (pessoas → vagas): ali a taxa não diz nada, então não aparece.
  const conversao = (i: number): string | null => {
    const e = etapas[i], ant = etapas[i - 1];
    if (!ant) return '100%';
    if (ant.unidade !== e.unidade) return null;
    if (e.id === 'efetivados') return concluiram ? `${pct(experiencia.efetivados, concluiram)}%` : null;
    return ant.valor ? `${pct(e.valor, ant.valor)}%` : null;
  };
  const conversaoLonga = (i: number): string | null => {
    const c = conversao(i);
    if (!c || i === 0) return null;
    return etapas[i].id === 'efetivados' ? `${c} de quem concluiu os 90 dias` : `${c} da etapa anterior`;
  };

  // O que sai de cada etapa rumo à próxima.
  const saida = (id: EtapaFunil['id']): Saida | null => {
    if (id === 'chamados') {
      const n = valor('chamados') - valor('compareceram');
      return n > 0 ? { destaque: `−${100 - pct(valor('compareceram'), valor('chamados'))}%`, texto: `${num(n)} não compareceram`, perda: true } : null;
    }
    if (id === 'aprovados') {
      const n = valor('aprovados') - valor('documentacao');
      return n > 0 ? { destaque: num(n), texto: 'aprovados ainda antes da documentação', perda: false } : null;
    }
    if (id === 'documentacao') {
      const n = valor('documentacao') - valor('contratados');
      return n > 0 ? { destaque: num(n), texto: 'em documentação agora', perda: false } : null;
    }
    if (id === 'contratados') {
      return experiencia.sairam > 0 ? { destaque: num(experiencia.sairam), texto: 'saíram na experiência', perda: true } : null;
    }
    if (id === 'efetivados') {
      return experiencia.emCurso > 0 || experiencia.semCadastro > 0
        ? { destaque: num(experiencia.emCurso), texto: `ainda nos 45/90 dias${experiencia.semCadastro ? ` · ${num(experiencia.semCadastro)} sem cadastro` : ''}`, perda: false }
        : null;
    }
    return null;
  };

  // O funil nunca alarga: cada faixa começa onde a anterior terminou, mesmo na
  // troca de fonte (pessoas → vagas). Sem isso ele "recomeçava" em Aprovados.
  const larguras = etapas.reduce<number[]>((ws, e, i) => [...ws, Math.min(largura(e.valor, max), i ? ws[i - 1] : 1)], []);

  return (
    <Painel titulo="Funil até a experiência" descricao={`${recorteRotulo}. Das seleções até quem passou dos 90 dias.`}>
      {/* Três colunas com o funil no meio, de largura contida: a etapa encosta
          nele pela esquerda, o que sai encosta pela direita. */}
      <ol className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,32rem)_minmax(0,1fr)] gap-x-4 md:gap-x-5 gap-y-[3px]">
        {etapas.map((e, i) => {
          const quebra = i > 0 && etapas[i - 1].unidade !== e.unidade;
          const topo = larguras[i];
          const base = larguras[i + 1] ?? topo * 0.72;
          const meio = (topo + base) / 2;
          const s = saida(e.id);
          const conv = conversao(i);
          const convLonga = conversaoLonga(i);
          const tom = TONS[i] ?? TONS[TONS.length - 1];
          return (
            <React.Fragment key={e.id}>
              {quebra && (
                <li aria-hidden="true" className="col-span-full py-1.5 flex items-center gap-3 text-[11px] font-medium text-slate-500">
                  <span className="h-px flex-1 bg-slate-200" />
                  daqui para baixo, pelo Quadro de Vagas: uma vaga, uma contratação
                  <span className="h-px flex-1 bg-slate-200" />
                </li>
              )}
              <li className="contents">
                {/* etapa */}
                <div className="flex flex-col justify-center min-h-[60px] md:text-right">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{e.rotulo}</p>
                  <p className="text-xs font-medium text-slate-500 leading-snug mt-0.5">{DESCRICAO[e.id]}</p>
                  {convLonga && <p className="md:hidden text-[11px] font-semibold text-slate-600 mt-0.5">{convLonga}</p>}
                  {s && <p className={`md:hidden text-[11px] font-semibold mt-0.5 ${s.perda ? 'text-rose-700' : 'text-slate-500'}`}>{s.destaque} · {s.texto}</p>}
                </div>

                {/* faixa: tom da mesma cor, claro no topo e cheio no resultado */}
                <div className="relative min-h-[60px]" title={`${e.rotulo}: ${num(e.valor)}`}>
                  <div className="absolute inset-0"
                    style={{
                      background: tom.fundo,
                      clipPath: `polygon(${(1 - topo) * 50}% 0, ${(1 + topo) * 50}% 0, ${(1 + base) * 50}% 100%, ${(1 - base) * 50}% 100%)`,
                    }} />
                  {s && (
                    <span aria-hidden="true" className="hidden md:block absolute top-1/2 right-0 border-t border-dotted border-slate-300"
                      style={{ left: `calc(${(1 + meio) * 50}% + 6px)` }} />
                  )}
                  <div className="relative h-full flex flex-col items-center justify-center text-center" style={{ color: tom.texto }}>
                    <span className="text-lg font-bold tabular-nums leading-none">{num(e.valor)}</span>
                    {conv && <span className="text-[11px] font-semibold tabular-nums mt-1 opacity-80">{conv}</span>}
                  </div>
                </div>

                {/* o que sai: mesma caixa para todas, perda em vermelho */}
                <div className="hidden md:flex items-center min-h-[60px]">
                  {s && (
                    <div className={`w-full max-w-[15rem] rounded-md border px-3 py-2 ${s.perda ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                      <p className={`text-sm font-bold tabular-nums leading-none ${s.perda ? 'text-rose-700' : 'text-slate-900'}`}>{s.destaque}</p>
                      <p className="text-xs font-medium text-slate-600 leading-snug mt-1">{s.texto}</p>
                    </div>
                  )}
                </div>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      <div className="mt-4 space-y-1.5">
        <Nota>
          A largura de cada faixa acompanha o número (em raiz, para as etapas pequenas continuarem visíveis).
          Experiência: cada contratado é procurado pelo nome no módulo Experiência — {num(experiencia.efetivados)} efetivados,
          {' '}{num(experiencia.sairam)} saíram, {num(experiencia.emCurso)} ainda nos 45/90 dias
          {experiencia.semCadastro > 0 && <> e {num(experiencia.semCadastro)} sem cadastro (ou com o nome escrito diferente)</>}.
          Só quem saiu conta como perda.
        </Nota>
        {!funil.incluiEmAndamento && (
          <Nota>Período passado: aprovado e documentação contam só as vagas que fecharam nele. As vagas em andamento entram quando o período inclui o mês atual.</Nota>
        )}
      </div>

      <TabelaDoGrafico titulo="Funil até a experiência" linhas={etapas.map((e, i) => ({ ...e, conv: conversaoLonga(i) || '—' }))}
        colunas={[
          { titulo: 'Etapa', valor: l => l.rotulo },
          { titulo: 'Quantidade', valor: l => num(l.valor), numerica: true },
          { titulo: 'Fonte', valor: l => (l.unidade === 'pessoas' ? 'Seleções (pessoas)' : 'Quadro de Vagas') },
          { titulo: 'Conversão', valor: l => l.conv },
        ]} />
    </Painel>
  );
};
