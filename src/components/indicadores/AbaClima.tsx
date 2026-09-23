/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Clima & Turnover: a movimentação do quadro mês a mês e o que as entrevistas
 * de desligamento dizem de quem saiu.
 *
 * ⚠️ Turnover é lançado por MÊS, sem sede: não segue o filtro de sede (a tela
 * diz isso onde o número aparece).
 */
import React, { useMemo } from 'react';
import type { Turnover, Entrevista } from '../../types';
import { taxaTurnover } from '../../utils/indicadores';
import { anoMesDeMesAno, MESES_CURTOS } from '../../utils/filtroIndicadores';
import { TabelaDoGrafico } from '../TabelaDoGrafico';
import { Painel, Kpi, Nota, Vazio, Dica, ListaComBarra, useEixos, num, dec, pct } from './ui';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from 'recharts';

const COBERTURA: Record<string, string> = { colegio: 'Colégio', universidade: 'Universidade', ambas: 'Colégio + Universidade', consolidado: 'unidade não informada' };

export const AbaClima: React.FC<{ turnover: Turnover[]; entrevistas: Entrevista[]; sedeFiltrada: boolean }> = ({ turnover, entrevistas, sedeFiltrada }) => {
  const { C, grade, eixo, cursorBarra, cursorLinha, legenda } = useEixos();

  /** Um ponto por mês, somando as unidades lançadas no mesmo mês. */
  const serie = useMemo(() => {
    const m = new Map<string, { chave: number; mes: string; admissoes: number; pediram: number; desligados: number; efetivo: number }>();
    for (const t of turnover) {
      const am = anoMesDeMesAno(t.mesAno); if (!am) continue;
      const k = t.mesAno.trim();
      const x = m.get(k) || { chave: am[0] * 12 + am[1], mes: `${MESES_CURTOS[am[1] - 1]}/${String(am[0]).slice(2)}`, admissoes: 0, pediram: 0, desligados: 0, efetivo: 0 };
      x.admissoes += t.totalAdmissao || 0; x.pediram += t.pediramSair || 0; x.desligados += t.foramDesligados || 0; x.efetivo += t.totalFuncionarios || 0;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => a.chave - b.chave).map(x => ({
      ...x, saidas: x.pediram + x.desligados,
      // A mesma fórmula do módulo Turnover — duas fórmulas sob a mesma palavra
      // dariam dois números diferentes no mesmo sistema.
      taxa: x.efetivo > 0 ? Number(((((x.admissoes + x.pediram + x.desligados) / 2) / x.efetivo) * 100).toFixed(1)) : null,
    }));
  }, [turnover]);
  const ult = useMemo(() => taxaTurnover(turnover), [turnover]);
  const somaAdm = serie.reduce((t, x) => t + x.admissoes, 0);
  const somaPed = serie.reduce((t, x) => t + x.pediram, 0);
  const somaDes = serie.reduce((t, x) => t + x.desligados, 0);

  const ent = useMemo(() => {
    const n = entrevistas.length;
    const media = (f: (e: Entrevista) => number) => {
      const v = entrevistas.map(f).filter(x => Number(x) > 0);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const dimensoes = [
      { nome: 'Clima organizacional', v: media(e => e.notaClimaOrg) },
      { nome: 'Relação com a chefia', v: media(e => e.notaRelacionamentoChefia) },
      { nome: 'Relação com os colegas', v: media(e => e.notaRelacionamentoColegas) },
      { nome: 'Treinamento', v: media(e => e.notaTreinamento) },
      { nome: 'Crescimento', v: media(e => e.notaCrescimento) },
      { nome: 'Salário', v: media(e => e.notaSalario) },
    ].filter(d => d.v !== null) as { nome: string; v: number }[];
    const motivos = new Map<string, number>();
    for (const e of entrevistas) { const k = (e.motivoSaida || '').trim() || 'Não informado'; motivos.set(k, (motivos.get(k) || 0) + 1); }
    return {
      n, clima: media(e => e.notaClimaOrg),
      voltaria: pct(entrevistas.filter(e => e.voltaria === 'Sim').length, n),
      talvez: pct(entrevistas.filter(e => e.voltaria === 'Talvez').length, n),
      gostava: pct(entrevistas.filter(e => e.gostavaTrabalho === 'Sim').length, n),
      dimensoes: dimensoes.sort((a, b) => a.v - b.v),
      motivos: [...motivos.entries()].map(([nome, valor]) => ({ nome, valor, detalhe: `${pct(valor, n)}%` })).sort((a, b) => b.valor - a.valor).slice(0, 8),
    };
  }, [entrevistas]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="cl-turn" className="space-y-4">
        <h3 id="cl-turn" className="text-base font-bold text-slate-900">Movimentação do quadro</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi rotulo={ult.temDados ? `Turnover · ${ult.mesAno}` : 'Turnover do mês'} valor={ult.temDados ? `${dec(ult.taxa)}%` : '—'}
            detalhe={ult.temDados ? `sobre ${num(ult.totalFuncionarios)} colaboradores · ${COBERTURA[ult.cobertura]}` : 'sem mês lançado no período'} />
          <Kpi rotulo="Admissões" valor={num(somaAdm)} detalhe={`${serie.length} ${serie.length === 1 ? 'mês' : 'meses'} lançados`} />
          <Kpi rotulo="Pediram para sair" valor={num(somaPed)} />
          <Kpi rotulo="Foram desligados" valor={num(somaDes)} />
        </div>
        {sedeFiltrada && <Nota>O turnover é lançado por mês, sem sede — estes números são da unidade inteira, não da sede escolhida.</Nota>}
        {serie.length === 0 ? <Painel titulo="Turnover"><Vazio>Nenhum mês de turnover lançado no período.</Vazio></Painel> : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Painel titulo="Taxa de turnover por mês" descricao="(admissões + saídas) ÷ 2, sobre o efetivo do mês.">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={serie} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} {...grade} />
                    <XAxis dataKey="mes" {...eixo} />
                    <YAxis {...eixo} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip cursor={cursorLinha} content={<Dica sufixo="%" />} />
                    <Line isAnimationActive={false} type="monotone" dataKey="taxa" name="Turnover" stroke={C.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: C.primary }} activeDot={{ r: 5 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Painel>
            <Painel titulo="Admissões × saídas" descricao="Saídas = pediram para sair + foram desligados.">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={serie} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} {...grade} />
                    <XAxis dataKey="mes" {...eixo} />
                    <YAxis {...eixo} allowDecimals={false} />
                    <Tooltip cursor={cursorBarra} content={<Dica formatar={(v: number, d: any) => v === d.saidas ? `${num(v)} (${d.pediram} pediram · ${d.desligados} desligados)` : num(v)} />} />
                    <Legend {...legenda} iconType="square" />
                    <Bar isAnimationActive={false} dataKey="admissoes" name="Admissões" fill={C.primary} radius={[4, 4, 0, 0]} maxBarSize={20} />
                    <Bar isAnimationActive={false} dataKey="saidas" name="Saídas" fill={C.amber} radius={[4, 4, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <TabelaDoGrafico titulo="Movimentação do quadro por mês" linhas={serie}
                colunas={[{ titulo: 'Mês', valor: l => l.mes }, { titulo: 'Efetivo', valor: l => l.efetivo, numerica: true }, { titulo: 'Admissões', valor: l => l.admissoes, numerica: true }, { titulo: 'Pediram', valor: l => l.pediram, numerica: true }, { titulo: 'Desligados', valor: l => l.desligados, numerica: true }, { titulo: 'Turnover', valor: l => (l.taxa == null ? '—' : `${dec(l.taxa)}%`), numerica: true }]} />
            </Painel>
          </div>
        )}
      </section>

      <section aria-labelledby="cl-ent" className="space-y-4">
        <h3 id="cl-ent" className="text-base font-bold text-slate-900">Entrevistas de desligamento</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi rotulo="Entrevistas" valor={num(ent.n)} />
          <Kpi rotulo="Nota do clima" valor={ent.clima !== null ? dec(ent.clima) : '—'} unidade={ent.clima !== null ? 'de 5' : undefined}
            tom={ent.clima !== null && ent.clima < 3 ? 'atencao' : 'neutro'} />
          <Kpi rotulo="Voltariam a trabalhar aqui" valor={ent.n ? `${ent.voltaria}%` : '—'} detalhe={ent.n ? `+ ${ent.talvez}% talvez` : undefined} />
          <Kpi rotulo="Gostavam do trabalho" valor={ent.n ? `${ent.gostava}%` : '—'} />
        </div>
        {ent.n === 0 ? <Painel titulo="Entrevistas"><Vazio>Nenhuma entrevista de desligamento no período e sede escolhidos.</Vazio></Painel> : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Painel titulo="Notas por tema" descricao="Média de 1 a 5, da pior para a melhor.">
              <ListaComBarra max={5} itens={ent.dimensoes.map(d => ({ nome: d.nome, valor: Math.round(d.v * 10) / 10 }))} />
            </Painel>
            <Painel titulo="Por que saíram">
              <ListaComBarra cor={C.amber} itens={ent.motivos} />
            </Painel>
          </div>
        )}
      </section>
    </div>
  );
};
