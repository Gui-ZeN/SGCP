/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vagas: o que está em aberto AGORA (não depende do período — uma vaga aberta
 * em março e ainda aberta é trabalho de hoje), o que abriu e fechou NO
 * período, e as mais antigas, pelo número, para o RH agir.
 */
import React, { useMemo } from 'react';
import type { Vaga } from '../../types';
import type { Sede } from '../../hooks/useMetadata';
import { SLA_META_DIAS } from '../../constants/hr';
import { ETAPAS_FUNIL, normalizeEtapa, diasNestaEtapa, getDiasEmAberto } from '../../utils/vaga';
import { siglaDaSede, anoMes, noPeriodo, MESES_CURTOS, type Periodo } from '../../utils/filtroIndicadores';
import { TabelaDoGrafico } from '../TabelaDoGrafico';
import { Painel, Kpi, Nota, Vazio, Dica, ListaComBarra, useEixos, num, pct } from './ui';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList } from 'recharts';

const EM_ANDAMENTO = ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'];
const st = (v: Vaga) => (v.status || '').toUpperCase();

export const AbaVagas: React.FC<{ vagas: Vaga[]; sedes: Sede[]; periodo: Periodo }> = ({ vagas, sedes, periodo }) => {
  const { C, grade, eixo, cursorBarra, legenda } = useEixos();

  const abertasAgora = useMemo(() => vagas.filter(v => EM_ANDAMENTO.includes(st(v))), [vagas]);
  const acimaDoPrazo = abertasAgora.filter(v => getDiasEmAberto(v) > SLA_META_DIAS).length;
  const abertasNoPeriodo = useMemo(() => vagas.filter(v => noPeriodo(periodo, anoMes(v.solicitacao))), [vagas, periodo]);
  const fechadasNoPeriodo = useMemo(() => vagas.filter(v => st(v) === 'FECHADA' && noPeriodo(periodo, anoMes(v.conclusao))), [vagas, periodo]);
  // Denominador honesto: fechada com tempo 0 ou negativo (herança do Excel) fica
  // de fora da média, e a tela diz quantas entraram.
  const comTempo = fechadasNoPeriodo.filter(v => (v.tempoProcesso || 0) > 0);
  const tempoMedio = comTempo.length ? Math.round(comTempo.reduce((t, v) => t + (v.tempoProcesso || 0), 0) / comTempo.length) : null;

  const porEtapa = useMemo(() => {
    const g = new Map<string, { qtd: number; dias: number; semData: number }>();
    for (const v of abertasAgora) {
      const et = normalizeEtapa(v);
      const x = g.get(et) || { qtd: 0, dias: 0, semData: 0 };
      x.qtd++; x.dias += diasNestaEtapa(v);
      if (!String(v.etapaDesde || '').trim()) x.semData++;
      g.set(et, x);
    }
    return ETAPAS_FUNIL.filter(et => g.has(et)).map(et => {
      const x = g.get(et)!;
      return { etapa: et, vagas: x.qtd, dias: Math.round(x.dias / x.qtd), semData: x.semData };
    });
  }, [abertasAgora]);
  const semDataEtapa = porEtapa.reduce((t, e) => t + e.semData, 0);

  const porSede = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of abertasAgora) { const s = siglaDaSede(sedes, v.sede) || 'Sem sede'; m.set(s, (m.get(s) || 0) + 1); }
    return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [abertasAgora, sedes]);

  const tempoPorSetor = useMemo(() => {
    const m = new Map<string, { soma: number; n: number }>();
    for (const v of comTempo) { const s = (v.setor || '').trim() || 'Sem setor'; const x = m.get(s) || { soma: 0, n: 0 }; x.soma += v.tempoProcesso || 0; x.n++; m.set(s, x); }
    return [...m.entries()].map(([nome, x]) => ({ nome, valor: Math.round(x.soma / x.n), detalhe: `${x.n} vaga${x.n > 1 ? 's' : ''}` }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [comTempo]);

  const motivos = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of abertasNoPeriodo) { const k = v.categoriaMotivo || 'Não informado'; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([nome, valor]) => ({ nome, valor, detalhe: `${pct(valor, abertasNoPeriodo.length)}%` })).sort((a, b) => b.valor - a.valor);
  }, [abertasNoPeriodo]);

  /** Abertas × fechadas, mês a mês do ano escolhido (ou ano a ano, sem ano). */
  const fluxo = useMemo(() => {
    if (periodo.ano === null) {
      const anos = new Map<number, { abertas: number; fechadas: number }>();
      for (const v of vagas) {
        const a = anoMes(v.solicitacao); if (a) { const x = anos.get(a[0]) || { abertas: 0, fechadas: 0 }; x.abertas++; anos.set(a[0], x); }
        const f = st(v) === 'FECHADA' ? anoMes(v.conclusao) : null; if (f) { const x = anos.get(f[0]) || { abertas: 0, fechadas: 0 }; x.fechadas++; anos.set(f[0], x); }
      }
      return [...anos.entries()].sort((a, b) => a[0] - b[0]).map(([ano, x]) => ({ rotulo: String(ano), ...x }));
    }
    const meses = MESES_CURTOS.map(rotulo => ({ rotulo, abertas: 0, fechadas: 0 }));
    for (const v of vagas) {
      const a = anoMes(v.solicitacao); if (a && a[0] === periodo.ano) meses[a[1] - 1].abertas++;
      const f = st(v) === 'FECHADA' ? anoMes(v.conclusao) : null; if (f && f[0] === periodo.ano) meses[f[1] - 1].fechadas++;
    }
    const ultimo = meses.reduce((u, m, i) => (m.abertas || m.fechadas ? i : u), -1);
    return meses.slice(0, ultimo + 1);
  }, [vagas, periodo.ano]);

  const maisAntigas = useMemo(
    () => [...abertasAgora].map(v => ({ v, dias: getDiasEmAberto(v) })).sort((a, b) => b.dias - a.dias).slice(0, 8),
    [abertasAgora]
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi rotulo="Em aberto agora" valor={num(abertasAgora.length)}
          tom={acimaDoPrazo ? 'atencao' : 'neutro'}
          detalhe={abertasAgora.length ? `${acimaDoPrazo} acima de ${SLA_META_DIAS} dias` : 'nenhuma vaga em andamento'} />
        <Kpi rotulo="Abertas no período" valor={num(abertasNoPeriodo.length)} detalhe="pela data de solicitação" />
        <Kpi rotulo="Fechadas no período" valor={num(fechadasNoPeriodo.length)} tom={fechadasNoPeriodo.length ? 'bom' : 'neutro'} detalhe="pela data de conclusão" />
        <Kpi rotulo="Tempo médio de fechamento" valor={tempoMedio ?? '—'} unidade={tempoMedio !== null ? 'dias' : undefined}
          tom={tempoMedio !== null && tempoMedio > SLA_META_DIAS ? 'atencao' : 'neutro'}
          detalhe={fechadasNoPeriodo.length ? `${comTempo.length} de ${fechadasNoPeriodo.length} fechadas têm o tempo registrado · meta ${SLA_META_DIAS} dias` : 'nenhuma fechada no período'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Painel titulo="Abertas × fechadas" descricao={periodo.ano === null ? 'Por ano.' : `Mês a mês, ${periodo.ano}.`}>
          {fluxo.length === 0 ? <Vazio>Nenhuma vaga aberta ou fechada no período.</Vazio> : (
            <>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={fluxo} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barGap={2}>
                    <CartesianGrid vertical={false} {...grade} />
                    <XAxis dataKey="rotulo" {...eixo} />
                    <YAxis {...eixo} allowDecimals={false} />
                    <Tooltip cursor={cursorBarra} content={<Dica />} />
                    <Legend {...legenda} iconType="square" />
                    <Bar isAnimationActive={false} dataKey="abertas" name="Abertas" fill={C.primary} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar isAnimationActive={false} dataKey="fechadas" name="Fechadas" fill={C.emerald} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <TabelaDoGrafico titulo="Vagas abertas e fechadas" linhas={fluxo}
                colunas={[{ titulo: periodo.ano === null ? 'Ano' : 'Mês', valor: l => l.rotulo }, { titulo: 'Abertas', valor: l => l.abertas, numerica: true }, { titulo: 'Fechadas', valor: l => l.fechadas, numerica: true }]} />
            </>
          )}
        </Painel>

        <Painel titulo="Em aberto por etapa" descricao="Quantas vagas estão em cada etapa agora, e há quantos dias, em média.">
          {porEtapa.length === 0 ? <Vazio>Nenhuma vaga em andamento.</Vazio> : (
            <>
              <div style={{ height: porEtapa.length * 40 + 16 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={porEtapa} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} {...grade} />
                    <XAxis type="number" {...eixo} allowDecimals={false} hide />
                    <YAxis dataKey="etapa" type="category" {...eixo} width={150} />
                    <Tooltip cursor={cursorBarra} content={<Dica formatar={(v: number, d: any) => `${v} · ${d.dias} dias em média`} />} />
                    <Bar isAnimationActive={false} dataKey="vagas" name="Vagas" fill={C.primary} radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList dataKey="dias" position="right" fontSize={11} fill={C.rotulo} formatter={(d: number) => `${d} d`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Barra = vagas na etapa · número ao lado = dias médios nela.</p>
              {semDataEtapa > 0 && (
                <Nota className="mt-2">{semDataEtapa} de {abertasAgora.length} vagas não têm a data de entrada na etapa: para elas, os dias contam desde a abertura, e a média sobe.</Nota>
              )}
              <TabelaDoGrafico titulo="Vagas em aberto por etapa" linhas={porEtapa}
                colunas={[{ titulo: 'Etapa', valor: l => l.etapa }, { titulo: 'Vagas', valor: l => l.vagas, numerica: true }, { titulo: 'Dias médios', valor: l => l.dias, numerica: true }]} />
            </>
          )}
        </Painel>
      </div>

      <Painel titulo="As mais antigas em aberto" descricao={`Em vermelho, acima da meta de ${SLA_META_DIAS} dias.`}>
        {maisAntigas.length === 0 ? <Vazio>Nenhuma vaga em andamento.</Vazio> : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                  <th scope="col" className="py-2 px-1 font-semibold">Código</th>
                  <th scope="col" className="py-2 px-1 font-semibold">Cargo</th>
                  <th scope="col" className="py-2 px-1 font-semibold">Sede</th>
                  <th scope="col" className="py-2 px-1 font-semibold">Etapa</th>
                  <th scope="col" className="py-2 px-1 font-semibold text-right">Dias em aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {maisAntigas.map(({ v, dias }) => (
                  <tr key={v.id}>
                    <td className="py-2 px-1 tabular-nums text-slate-500">#{v.codigo}</td>
                    <td className="py-2 px-1 font-semibold text-slate-800">{v.vaga}</td>
                    <td className="py-2 px-1 text-slate-700">{siglaDaSede(sedes, v.sede) || '—'}</td>
                    <td className="py-2 px-1 text-slate-700">{normalizeEtapa(v)}</td>
                    <td className={`py-2 px-1 text-right tabular-nums font-bold ${dias > SLA_META_DIAS ? 'text-rose-700' : 'text-slate-900'}`}>{num(dias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Painel titulo="Em aberto por sede">
          {porSede.length ? <ListaComBarra itens={porSede.slice(0, 10)} /> : <Vazio>Nenhuma vaga em andamento.</Vazio>}
        </Painel>
        <Painel titulo="Tempo de fechamento por setor" descricao="Fechadas no período, em dias.">
          {tempoPorSetor.length ? <ListaComBarra itens={tempoPorSetor} sufixo=" d" /> : <Vazio>Nenhuma fechada com tempo registrado.</Vazio>}
        </Painel>
        <Painel titulo="Motivo de abertura" descricao="Vagas abertas no período.">
          {motivos.length ? <ListaComBarra itens={motivos} /> : <Vazio>Nenhuma vaga aberta no período.</Vazio>}
        </Painel>
      </div>
    </div>
  );
};
