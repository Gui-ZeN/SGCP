/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Seleções — Geral × Pedagógico, no formato do "Dashboard Executivo R&S 2026"
 * que o RH montou no Excel: convocados por sede (barras), convocados ×
 * compareceram por mês (linhas) e motivos de desistência.
 *
 * A separação é a aba QUANTI de origem (`origem`). ⚠️ O Pedagógico não registra
 * contratação nem motivo — a aba não tem essas colunas. Ali o painel diz "sem
 * registro", nunca 0, que afirmaria que ninguém foi contratado.
 */
import React, { useMemo, useState } from 'react';
import type { Selecao } from '../../types';
import type { Sede } from '../../hooks/useMetadata';
import {
  doRecorte, indicadoresSelecao, selecaoPorMes, funilPorChave, motivosDesistencia,
  type RecorteSelecao, type IndicadoresSelecao,
} from '../../utils/indicadores';
import { siglaDaSede, type Periodo } from '../../utils/filtroIndicadores';
import { TabelaDoGrafico } from '../TabelaDoGrafico';
import { Painel, Kpi, Nota, Vazio, Dica, ListaComBarra, useEixos, num, dec } from './ui';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line, LabelList } from 'recharts';

type Modo = RecorteSelecao | 'comparar';
const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'ambos', rotulo: 'Todas' },
  { id: 'geral', rotulo: 'Geral' },
  { id: 'pedagogico', rotulo: 'Pedagógico' },
  { id: 'comparar', rotulo: 'Geral × Pedagógico' },
];
const SEM_REGISTRO = 'sem registro';
const ORDEM_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Motivo gravado pelo import vem em minúsculas: só a primeira letra sobe. */
const frase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const AbaSelecoes: React.FC<{
  selecoes: Selecao[]; sedes: Sede[]; periodo: Periodo;
  /** Vagas do setor Pedagógico fechadas no período (Quadro) — estimativa de contratações. */
  fechadasPedagogico?: number;
}> = ({ selecoes, sedes, fechadasPedagogico = 0 }) => {
  const { C, grade, eixo, cursorBarra, cursorLinha, legenda } = useEixos();
  const COR = { geral: C.primary, pedagogico: C.amber };
  const [modo, setModo] = useState<Modo>('ambos');
  const recorte: RecorteSelecao = modo === 'comparar' ? 'ambos' : modo;

  const lista = useMemo(() => doRecorte(selecoes, recorte), [selecoes, recorte]);
  const ind = useMemo(() => indicadoresSelecao(lista), [lista]);
  const porMes = useMemo(() => selecaoPorMes(lista), [lista]);
  const porSede = useMemo(() => funilPorChave(lista, s => siglaDaSede(sedes, s.sede) || 'Sem sede').slice(0, 12), [lista, sedes]);
  const porCargo = useMemo(() => funilPorChave(lista, s => s.cargo).slice(0, 10), [lista]);
  // Pedagógico sem coluna CONTRATADO: estimativa pelas vagas fechadas no Quadro.
  const estimativa = recorte === 'pedagogico' && !ind.contratacao && fechadasPedagogico > 0 ? fechadasPedagogico : null;
  const motivos = useMemo(() => motivosDesistencia(doRecorte(lista, 'geral')), [lista]);
  const totalMotivos = motivos.reduce((t, m) => t + m.total, 0);

  const geral = useMemo(() => indicadoresSelecao(doRecorte(selecoes, 'geral')), [selecoes]);
  const ped = useMemo(() => indicadoresSelecao(doRecorte(selecoes, 'pedagogico')), [selecoes]);
  const mesAMes = useMemo(() => {
    const g = selecaoPorMes(doRecorte(selecoes, 'geral'));
    const p = selecaoPorMes(doRecorte(selecoes, 'pedagogico'));
    return [...new Set([...g, ...p].map(x => x.mes))].sort((a, b) => ORDEM_MES.indexOf(a) - ORDEM_MES.indexOf(b)).map(mes => {
      const gm = g.find(x => x.mes === mes); const pm = p.find(x => x.mes === mes);
      return {
        mes, convGeral: gm?.convocados ?? 0, convPed: pm?.convocados ?? 0,
        // Mês sem seleção numa das bases fica sem ponto, não com 0%.
        taxaGeral: gm && gm.convocados ? gm.taxa : null, taxaPed: pm && pm.convocados ? pm.taxa : null,
      };
    });
  }, [selecoes]);

  const seletor = (
    <div role="group" aria-label="Recorte das seleções" className="inline-flex flex-wrap p-1 bg-slate-100 rounded-lg gap-0.5">
      {MODOS.map(m => (
        <button key={m.id} type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${modo === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          {m.rotulo}
        </button>
      ))}
    </div>
  );

  if (selecoes.length === 0) return <Painel titulo="Seleções"><Vazio>Nenhuma seleção no período e sede escolhidos.</Vazio></Painel>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {seletor}
        <p className="text-[11px] text-slate-500 font-medium">Pela aba de origem na planilha: QUANTI Geral ou QUANTI Pedagógico.</p>
      </div>

      {modo === 'comparar' ? (
        <Comparativo geral={geral} ped={ped} mesAMes={mesAMes} COR={COR} fechadasPedagogico={fechadasPedagogico} />
      ) : ind.eventos === 0 ? (
        <Painel titulo="Seleções"><Vazio>Nenhuma seleção realizada neste recorte.</Vazio></Painel>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Kpi rotulo="Convocados" valor={num(ind.convocados)} detalhe={`${num(ind.eventos)} dias de seleção`} />
            <Kpi rotulo="Compareceram" valor={num(ind.compareceram)} detalhe={`${ind.taxaComparecimento}% dos convocados`} />
            <Kpi rotulo="Ausentes" valor={num(ind.ausentes)} tom={ind.taxaAusencia >= 50 ? 'atencao' : 'neutro'} detalhe={`${ind.taxaAusencia}% dos convocados`} />
            <Kpi rotulo="Desistências" valor={num(ind.desistiram)} />
            {estimativa !== null ? (
              <>
                <Kpi rotulo="Contratados (estimativa)" valor={`≈ ${num(estimativa)}`}
                  detalhe="vagas pedagógicas fechadas no Quadro" />
                <Kpi rotulo="Convocações por contratação" valor={`≈ ${dec(ind.convocados / estimativa)}`}
                  detalhe="estimativa pelas vagas fechadas" />
              </>
            ) : (
              <>
                <Kpi rotulo="Contratados" valor={ind.contratacao ? num(ind.contratacao.contratados) : '—'}
                  detalhe={ind.contratacao ? (recorte === 'ambos' ? 'só a base Geral registra' : `${ind.contratacao.conversaoPresentes}% de quem compareceu`) : SEM_REGISTRO} />
                <Kpi rotulo="Convocações por contratação" valor={ind.contratacao?.convocadosPorContratacao != null ? dec(ind.contratacao.convocadosPorContratacao) : '—'}
                  detalhe={ind.contratacao ? 'base Geral' : SEM_REGISTRO} />
              </>
            )}
          </div>

          {recorte === 'pedagogico' && <Nota>{estimativa !== null
            ? 'A planilha pedagógica não registra contratações: o número vem das vagas do setor Pedagógico fechadas no Quadro no período (cada vaga fechada = uma contratação). Motivo de desistência segue sem registro.'
            : 'A planilha pedagógica não registra contratações nem motivo de desistência — por isso esses indicadores ficam sem valor aqui.'}</Nota>}
          {ind.inconsistentes > 0 && (
            <Nota>Em {ind.inconsistentes} dos {ind.eventos} dias, convocados ≠ compareceram + ausentes na planilha. As taxas usam os convocados como registrados.</Nota>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Painel titulo="Convocados por sede" descricao="Ao lado, quanto dos convocados compareceu.">
              <div style={{ height: porSede.length * 34 + 16 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={porSede} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} {...grade} />
                    <XAxis type="number" {...eixo} hide />
                    <YAxis dataKey="name" type="category" {...eixo} width={72} />
                    <Tooltip cursor={cursorBarra} content={<Dica formatar={(v: number, d: any) => `${num(v)} · ${d.taxa}% vieram`} />} />
                    <Bar isAnimationActive={false} dataKey="convocados" name="Convocados" fill={C.primary} radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList dataKey="convocados" position="right" fontSize={11} fill={C.rotulo}
                        formatter={(v: number) => num(v)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <TabelaDoGrafico titulo="Convocados por sede" linhas={porSede}
                colunas={[{ titulo: 'Sede', valor: l => l.name }, { titulo: 'Convocados', valor: l => l.convocados, numerica: true }, { titulo: 'Compareceram', valor: l => l.compareceram, numerica: true }, { titulo: 'Comparecimento', valor: l => `${l.taxa}%`, numerica: true }]} />
            </Painel>

            <Painel titulo="Convocados × compareceram, por mês">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={porMes} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} {...grade} />
                    <XAxis dataKey="mes" {...eixo} />
                    <YAxis {...eixo} allowDecimals={false} />
                    <Tooltip cursor={cursorLinha} content={<Dica />} />
                    <Legend {...legenda} iconType="plainline" />
                    <Line isAnimationActive={false} type="monotone" dataKey="convocados" name="Convocados" stroke={C.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: C.primary }} activeDot={{ r: 5 }} />
                    <Line isAnimationActive={false} type="monotone" dataKey="compareceram" name="Compareceram" stroke={C.emerald} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: C.emerald }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <TabelaDoGrafico titulo="Seleções por mês" linhas={porMes}
                colunas={[{ titulo: 'Mês', valor: l => l.mes }, { titulo: 'Convocados', valor: l => l.convocados, numerica: true }, { titulo: 'Compareceram', valor: l => l.compareceram, numerica: true }, { titulo: 'Ausentes', valor: l => l.ausentes, numerica: true }, { titulo: 'Desistiram', valor: l => l.desistiram, numerica: true }, { titulo: 'Comparecimento', valor: l => `${l.taxa}%`, numerica: true }]} />
            </Painel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Painel titulo="Motivos de desistência" descricao={recorte === 'geral' ? undefined : 'Só a base Geral registra o motivo.'}>
              {recorte === 'pedagogico' ? <Vazio>A planilha pedagógica não registra o motivo da desistência.</Vazio>
                : motivos.length === 0 ? <Vazio>Nenhum motivo registrado.</Vazio>
                : <ListaComBarra cor={C.amber} itens={motivos.slice(0, 8).map(m => ({ nome: frase(m.name), valor: m.total, detalhe: `${Math.round((m.total / totalMotivos) * 100)}%` }))} />}
            </Painel>

            <Painel titulo="Cargos com mais convocações">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                    <th scope="col" className="py-2 pr-2 font-semibold">Cargo</th>
                    <th scope="col" className="py-2 px-2 font-semibold text-right">Convocados</th>
                    <th scope="col" className="py-2 px-2 font-semibold text-right">Vieram</th>
                    <th scope="col" className="py-2 pl-2 font-semibold text-right">Comparec.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {porCargo.map(c => (
                    <tr key={c.name}>
                      <td className="py-2 pr-2 font-semibold text-slate-800">{c.name}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{num(c.convocados)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{num(c.compareceram)}</td>
                      <td className={`py-2 pl-2 text-right tabular-nums font-bold ${c.taxa < 25 ? 'text-rose-700' : 'text-slate-900'}`}>{c.taxa}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Painel>
          </div>
        </>
      )}
    </div>
  );
};

/** Um contra o outro: a tabela lado a lado e as duas séries mês a mês. */
const Comparativo: React.FC<{
  geral: IndicadoresSelecao; ped: IndicadoresSelecao;
  mesAMes: { mes: string; convGeral: number; convPed: number; taxaGeral: number | null; taxaPed: number | null }[];
  COR: { geral: string; pedagogico: string };
  fechadasPedagogico: number;
}> = ({ geral, ped, mesAMes, COR, fechadasPedagogico }) => {
  const { grade, eixo, cursorBarra, cursorLinha, legenda } = useEixos();
  const linhas: [string, string, string][] = [
    ['Dias de seleção', num(geral.eventos), num(ped.eventos)],
    ['Convocados', num(geral.convocados), num(ped.convocados)],
    ['Compareceram', num(geral.compareceram), num(ped.compareceram)],
    ['Ausentes', num(geral.ausentes), num(ped.ausentes)],
    ['Desistências', num(geral.desistiram), num(ped.desistiram)],
    ['Comparecimento', `${geral.taxaComparecimento}%`, `${ped.taxaComparecimento}%`],
    ['Ausência', `${geral.taxaAusencia}%`, `${ped.taxaAusencia}%`],
    ['Contratados', geral.contratacao ? num(geral.contratacao.contratados) : '—', fechadasPedagogico ? `≈ ${num(fechadasPedagogico)} (vagas fechadas)` : SEM_REGISTRO],
    ['Convocações por contratação', geral.contratacao?.convocadosPorContratacao != null ? dec(geral.contratacao.convocadosPorContratacao) : '—', fechadasPedagogico ? `≈ ${dec(ped.convocados / fechadasPedagogico)}` : SEM_REGISTRO],
  ];
  const marca = (cor: string) => <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ background: cor }} aria-hidden="true" />;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      <Painel titulo="Lado a lado" className="xl:col-span-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              <th scope="col" className="py-2 pr-2 text-left font-semibold">Indicador</th>
              <th scope="col" className="py-2 px-2 text-right font-semibold">{marca(COR.geral)}Geral</th>
              <th scope="col" className="py-2 pl-2 text-right font-semibold">{marca(COR.pedagogico)}Pedagógico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map(([rot, g, p]) => (
              <tr key={rot}>
                <th scope="row" className="py-2 pr-2 text-left font-medium text-slate-600">{rot}</th>
                <td className="py-2 px-2 text-right tabular-nums font-bold text-slate-900">{g}</td>
                <td className={`py-2 pl-2 text-right tabular-nums ${p === SEM_REGISTRO ? 'text-[11px] font-medium text-slate-500' : 'font-bold text-slate-900'}`}>{p}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Nota className="mt-3">A planilha pedagógica não registra contratações nem motivo de desistência.</Nota>
      </Painel>

      <div className="xl:col-span-3 space-y-5 min-w-0">
        <Painel titulo="Comparecimento por mês" descricao="Quanto dos convocados apareceu, em cada base.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={mesAMes} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} {...grade} />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis domain={[0, 100]} {...eixo} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip cursor={cursorLinha} content={<Dica sufixo="%" />} />
                <Legend {...legenda} iconType="plainline" />
                <Line isAnimationActive={false} type="monotone" dataKey="taxaGeral" name="Geral" stroke={COR.geral} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COR.geral }} connectNulls={false} />
                <Line isAnimationActive={false} type="monotone" dataKey="taxaPed" name="Pedagógico" stroke={COR.pedagogico} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COR.pedagogico }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Painel>
        <Painel titulo="Convocados por mês">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={mesAMes} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} {...grade} />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis {...eixo} allowDecimals={false} />
                <Tooltip cursor={cursorBarra} content={<Dica />} />
                <Legend {...legenda} iconType="square" />
                <Bar isAnimationActive={false} dataKey="convGeral" name="Geral" fill={COR.geral} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar isAnimationActive={false} dataKey="convPed" name="Pedagógico" fill={COR.pedagogico} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TabelaDoGrafico titulo="Geral × Pedagógico por mês" linhas={mesAMes}
            colunas={[
              { titulo: 'Mês', valor: l => l.mes },
              { titulo: 'Convocados Geral', valor: l => l.convGeral, numerica: true },
              { titulo: 'Convocados Pedagógico', valor: l => l.convPed, numerica: true },
              { titulo: 'Comparec. Geral', valor: l => (l.taxaGeral == null ? '—' : `${l.taxaGeral}%`), numerica: true },
              { titulo: 'Comparec. Pedagógico', valor: l => (l.taxaPed == null ? '—' : `${l.taxaPed}%`), numerica: true },
            ]} />
        </Painel>
      </div>
    </div>
  );
};
