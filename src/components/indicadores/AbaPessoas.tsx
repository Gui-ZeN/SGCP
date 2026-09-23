/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pessoas: treinamentos, integração de quem chega e período de experiência.
 */
import React, { useMemo } from 'react';
import type { Treinamento, Experiencia, Integracao } from '../../types';
import type { Sede } from '../../hooks/useMetadata';
import { diasEntre, dataISOLocal } from '../../utils/date';
import { siglaDaSede, anoMes, MESES_CURTOS, type Periodo } from '../../utils/filtroIndicadores';
import { TabelaDoGrafico } from '../TabelaDoGrafico';
import { Painel, Kpi, Nota, Vazio, Dica, ListaComBarra, useEixos, num, pct } from './ui';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

/**
 * Avaliações de 45/90 dias até `dentro` dias à frente, e as já atrasadas
 * (dias negativos). A de 45 dias vale para quem está em análise; a de 90, para
 * quem foi prorrogado.
 */
/**
 * Passou do prazo há mais que isto = não é avaliação a fazer, é desfecho que
 * nunca foi lançado. Medido em 23/09/2026: das 91 atrasadas, 78 venceram há
 * mais de 30 dias (algumas em 2024) — misturadas às 13 recentes, o alerta
 * gritava "91" e ninguém sabia por onde começar.
 */
export const LIMITE_ATRASO_DIAS = 30;

export function avaliacoesAVencer(experiencias: Experiencia[], dentro = 15, hoje = dataISOLocal()) {
  const lista: { e: Experiencia; marco: '45 dias' | '90 dias'; dias: number }[] = [];
  for (const e of experiencias) {
    const marco = e.status === 'EM_ANALISE' ? { data: e.termino1, rot: '45 dias' as const }
      : e.status === 'PRORROGADO' ? { data: e.termino2, rot: '90 dias' as const } : null;
    if (!marco?.data) continue;
    const d = diasEntre(hoje, marco.data);
    if (d !== null && d <= dentro) lista.push({ e, marco: marco.rot, dias: d });
  }
  return lista.sort((a, b) => a.dias - b.dias);
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

interface Props {
  treinamentos: Treinamento[];
  experiencias: Experiencia[];
  /** Todas as experiências da sede, sem o período: o que vence é de hoje. */
  experienciasEmCurso: Experiencia[];
  integracoes: Integracao[];
  integracoesSemData: number;
  mostrarIntegracao: boolean;
  sedes: Sede[];
  periodo: Periodo;
}

export const AbaPessoas: React.FC<Props> = ({ treinamentos, experiencias, experienciasEmCurso, integracoes, integracoesSemData, mostrarIntegracao, sedes, periodo }) => {
  const { C, grade, eixo, cursorBarra } = useEixos();

  // ── treinamentos ──
  const tr = useMemo(() => {
    const soma = (f: (t: Treinamento) => number) => treinamentos.reduce((a, t) => a + (Number(f(t)) || 0), 0);
    return {
      turmas: treinamentos.length,
      previstos: soma(t => t.qtdPrevista), treinados: soma(t => t.qtdRealizada),
      horas: soma(t => t.totalHorasFormacao), investido: soma(t => t.valorInvestido),
    };
  }, [treinamentos]);
  const porMes = useMemo(() => {
    if (periodo.ano === null) return [];
    const m = MESES_CURTOS.map(mes => ({ mes, treinados: 0, turmas: 0 }));
    for (const t of treinamentos) { const am = anoMes(t.dataInicio); if (am && am[0] === periodo.ano) { m[am[1] - 1].treinados += t.qtdRealizada || 0; m[am[1] - 1].turmas++; } }
    const ultimo = m.reduce((u, x, i) => (x.turmas ? i : u), -1);
    return m.slice(0, ultimo + 1);
  }, [treinamentos, periodo.ano]);
  const porTipo = useMemo(() => {
    const g = new Map<string, number>();
    for (const t of treinamentos) g.set(t.tipo || 'Sem tipo', (g.get(t.tipo || 'Sem tipo') || 0) + (t.qtdRealizada || 0));
    return [...g.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [treinamentos]);
  const temas = useMemo(() => [...treinamentos].sort((a, b) => (b.qtdRealizada || 0) - (a.qtdRealizada || 0)).slice(0, 6), [treinamentos]);

  // ── integração ──
  const integ = useMemo(() => {
    const c = (s: Integracao['status']) => integracoes.filter(i => i.status === s).length;
    const realizadas = c('Realizado'), pendentes = c('Não realizado'), desligados = c('Desligado');
    const pendentesPorSede = new Map<string, number>();
    for (const i of integracoes) if (i.status === 'Não realizado') { const s = siglaDaSede(sedes, i.sede) || 'Sem sede'; pendentesPorSede.set(s, (pendentesPorSede.get(s) || 0) + 1); }
    return { realizadas, pendentes, desligados, total: integracoes.length, pendentesPorSede: [...pendentesPorSede.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor) };
  }, [integracoes, sedes]);

  // ── experiência ──
  const exp = useMemo(() => {
    const c = (s: Experiencia['status']) => experiencias.filter(e => e.status === s).length;
    const efetivados = c('EFETIVADO'), encerrados = c('ENCERRADO');
    const aPedido = experiencias.filter(e => e.status === 'ENCERRADO' && e.tipoEncerramento === 'a_pedido').length;
    return { total: experiencias.length, emAnalise: c('EM_ANALISE'), prorrogados: c('PRORROGADO'), efetivados, encerrados, aPedido, decididos: efetivados + encerrados };
  }, [experiencias]);
  const todas = useMemo(() => avaliacoesAVencer(experienciasEmCurso), [experienciasEmCurso]);
  const vencendo = todas.filter(x => x.dias >= -LIMITE_ATRASO_DIAS);
  const semDesfecho = todas.length - vencendo.length;

  return (
    <div className="space-y-8">
      {/* Treinamentos */}
      <section aria-labelledby="pes-trein" className="space-y-4">
        <h3 id="pes-trein" className="text-base font-bold text-slate-900">Treinamentos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi rotulo="Pessoas treinadas" valor={num(tr.treinados)} detalhe={`em ${num(tr.turmas)} turma${tr.turmas === 1 ? '' : 's'}`} />
          <Kpi rotulo="Aproveitamento" valor={tr.previstos ? `${pct(tr.treinados, tr.previstos)}%` : '—'}
            tom={tr.previstos && pct(tr.treinados, tr.previstos) < 70 ? 'atencao' : 'neutro'}
            detalhe={tr.previstos ? `${num(tr.treinados)} de ${num(tr.previstos)} previstos` : 'sem previsão registrada'} />
          <Kpi rotulo="Horas de formação" valor={num(Math.round(tr.horas))} unidade="h" />
          <Kpi rotulo="Investimento" valor={brl(tr.investido)} />
        </div>
        {treinamentos.length === 0 ? <Painel titulo="Treinamentos"><Vazio>Nenhum treinamento no período e sede escolhidos.</Vazio></Painel> : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {porMes.length > 0 && (
              <Painel titulo="Pessoas treinadas por mês" descricao={String(periodo.ano)} className="xl:col-span-2">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={porMes} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} {...grade} />
                      <XAxis dataKey="mes" {...eixo} />
                      <YAxis {...eixo} allowDecimals={false} />
                      <Tooltip cursor={cursorBarra} content={<Dica formatar={(v: number, d: any) => `${num(v)} · ${d.turmas} turma(s)`} />} />
                      <Bar isAnimationActive={false} dataKey="treinados" name="Treinados" fill={C.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <TabelaDoGrafico titulo="Pessoas treinadas por mês" linhas={porMes}
                  colunas={[{ titulo: 'Mês', valor: l => l.mes }, { titulo: 'Treinados', valor: l => l.treinados, numerica: true }, { titulo: 'Turmas', valor: l => l.turmas, numerica: true }]} />
              </Painel>
            )}
            <Painel titulo="Por tipo" descricao="Pessoas treinadas." className={porMes.length ? '' : 'xl:col-span-3'}>
              <ListaComBarra itens={porTipo} />
            </Painel>
            <Painel titulo="Turmas com mais gente" className="xl:col-span-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                    <th scope="col" className="py-2 pr-2 font-semibold">Tema</th>
                    <th scope="col" className="py-2 px-2 font-semibold">Início</th>
                    <th scope="col" className="py-2 px-2 font-semibold">Unidade</th>
                    <th scope="col" className="py-2 pl-2 font-semibold text-right">Presentes / previstos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {temas.map(t => (
                    <tr key={t.id}>
                      <td className="py-2 pr-2 font-semibold text-slate-800">{t.tema}</td>
                      <td className="py-2 px-2 tabular-nums text-slate-600">{t.dataInicio}</td>
                      <td className="py-2 px-2 text-slate-600">{siglaDaSede(sedes, t.unidade) || '—'}</td>
                      <td className="py-2 pl-2 text-right tabular-nums font-bold text-slate-900">{num(t.qtdRealizada || 0)} / {num(t.qtdPrevista || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Painel>
          </div>
        )}
      </section>

      {/* Experiência */}
      <section aria-labelledby="pes-exp" className="space-y-4">
        <h3 id="pes-exp" className="text-base font-bold text-slate-900">Período de experiência</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi rotulo="Em acompanhamento" valor={num(exp.emAnalise + exp.prorrogados)} detalhe={`${exp.prorrogados} prorrogado${exp.prorrogados === 1 ? '' : 's'} para 90 dias`} />
          <Kpi rotulo="Efetivados" valor={num(exp.efetivados)} tom={exp.efetivados ? 'bom' : 'neutro'}
            detalhe={exp.decididos ? `${pct(exp.efetivados, exp.decididos)}% dos que já tiveram desfecho` : 'nenhum desfecho no período'} />
          <Kpi rotulo="Encerrados" valor={num(exp.encerrados)} detalhe={exp.encerrados ? `${exp.aPedido} a pedido do colaborador` : undefined} />
          <Kpi rotulo="Avaliações nos próximos 15 dias" valor={num(vencendo.filter(v => v.dias >= 0).length)}
            tom={vencendo.some(v => v.dias < 0) ? 'critico' : vencendo.length ? 'atencao' : 'neutro'}
            detalhe={vencendo.some(v => v.dias < 0) ? `+ ${vencendo.filter(v => v.dias < 0).length} atrasada(s) há até ${LIMITE_ATRASO_DIAS} dias` : 'de 45 e 90 dias'} />
        </div>
        {vencendo.length > 0 && (
          <Painel titulo="Avaliações a fazer" descricao="Atrasadas primeiro. Não depende do período: é o que vence agora.">
            <ul className="divide-y divide-slate-100">
              {vencendo.slice(0, 10).map(({ e, marco, dias }) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-800">{e.colaborador}</span>
                    <span className="text-slate-500"> · {e.funcao} · {siglaDaSede(sedes, e.sede) || e.setor}</span>
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${dias < 0 ? 'text-rose-700' : dias <= 3 ? 'text-amber-700' : 'text-slate-700'}`}>
                    {marco} · {dias < 0 ? `atrasada ${-dias} d` : dias === 0 ? 'hoje' : `em ${dias} d`}
                  </span>
                </li>
              ))}
            </ul>
            {vencendo.length > 10 && <p className="text-[11px] text-slate-500 font-medium mt-2">e mais {vencendo.length - 10} — veja na aba Experiência.</p>}
          </Painel>
        )}
        {semDesfecho > 0 && (
          <Nota>{semDesfecho} experiência(s) passaram do prazo há mais de {LIMITE_ATRASO_DIAS} dias e seguem sem desfecho lançado — efetive ou encerre na aba Experiência para saírem desta conta.</Nota>
        )}
      </section>

      {/* Integração */}
      {mostrarIntegracao && (
        <section aria-labelledby="pes-integ" className="space-y-4">
          <h3 id="pes-integ" className="text-base font-bold text-slate-900">Integração de novos colaboradores</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi rotulo="Realizadas" valor={num(integ.realizadas)} tom={integ.realizadas ? 'bom' : 'neutro'}
              detalhe={integ.total ? `${pct(integ.realizadas, integ.total - integ.desligados)}% de quem continua na empresa` : undefined} />
            <Kpi rotulo="Pendentes" valor={num(integ.pendentes)} tom={integ.pendentes ? 'atencao' : 'neutro'} />
            <Kpi rotulo="Desligados antes" valor={num(integ.desligados)} detalhe="saíram sem fazer a integração" />
            <Kpi rotulo="Total no período" valor={num(integ.total)} detalhe="pela data de admissão" />
          </div>
          {integ.pendentesPorSede.length > 0 && (
            <Painel titulo="Pendentes por sede"><ListaComBarra cor={C.amber} itens={integ.pendentesPorSede} /></Painel>
          )}
          {integracoesSemData > 0 && periodo.ano !== null && (
            <Nota>{integracoesSemData} integração(ões) sem data de admissão ficam fora do recorte por período — aparecem em "Todo o período".</Nota>
          )}
        </section>
      )}
    </div>
  );
};
