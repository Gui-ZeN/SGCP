/**
 * Absenteísmo — o indicador que mora no Chromos (06/10/2026).
 *
 * A conta é a da tela de Absenteísmo do Chromos e chega pronta pela ponte
 * `/api/absenteismo`: horas perdidas ÷ (quadro ativo × dias úteis × 44/6 h),
 * com feriados de Fortaleza fora e contestação aceita derrubando a falta.
 * Aqui só se mostra. Só a Infraestrutura: é o quadro que o Chromos tem.
 *
 * ⚠️ AS SEDES SÃO AS DO CHROMOS. Os códigos não batem com os do SGPC (DT lá é
 * DT1/DT2/PDT; BEN lá é Unichristus), então o filtro de sede dos Indicadores
 * não se aplica — e a tela diz isso, em vez de traduzir no chute.
 */
import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAbsenteismo, type Absenteismo, type ClasseFalta, type PessoaAbs } from '../../hooks/useAbsenteismo';
import { dataISOLocal } from '../../utils/date';
import { MESES_CURTOS, type Periodo } from '../../utils/filtroIndicadores';
import { TabelaDoGrafico } from '../TabelaDoGrafico';
import { Painel, Kpi, Nota, Vazio, Dica, ListaComBarra, useEixos, num, dec } from './ui';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, Legend, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const CHROMOS = 'https://cromos-infra.vercel.app/absenteismo';
const pctDe = (t: number | null) => (t === null ? null : Math.round(t * 1000) / 10);
const rotuloMes = (m: string) => `${MESES_CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

const Fonte = () => (
    <a href={CHROMOS} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
      Ver no Chromos <ExternalLink className="w-3 h-3" aria-hidden="true" />
    </a>
);

export const AbaAbsenteismo: React.FC<{ periodo: Periodo; sedeFiltrada: boolean }> = ({ periodo, sedeFiltrada }) => {
  const estado = useAbsenteismo(periodo, dataISOLocal());
  if (estado.tipo === 'futuro') return <Painel titulo="Absenteísmo"><Vazio>O período escolhido ainda não começou.</Vazio></Painel>;
  if (estado.tipo === 'carregando') return <Painel titulo="Absenteísmo"><Vazio>Buscando a taxa no Chromos…</Vazio></Painel>;
  if (estado.tipo === 'erro') return <Painel titulo="Absenteísmo" acoes={<Fonte />}><Vazio>{estado.texto}</Vazio></Painel>;
  return <PainelAbsenteismo dados={estado.dados} sedeFiltrada={sedeFiltrada} />;
};

/** O desenho, separado do pedido: recebe a resposta do Chromos pronta. */
export const PainelAbsenteismo: React.FC<{ dados: Absenteismo; sedeFiltrada: boolean }> = ({ dados, sedeFiltrada }) => {
  const { C, grade, eixo, cursorLinha, cursorBarra, legenda } = useEixos();
  const [visaoMes, setVisaoMes] = useState<'taxa' | 'tipo'>('tipo');
  const [ordem, setOrdem] = useState<'taxa' | 'injustificada' | 'atestado'>('taxa');
  const [busca, setBusca] = useState('');
  const [todas, setTodas] = useState(false);

  // Injustificada é a que pede ação: âmbar. Atestado no acento; o resto em cinza.
  const TIPOS: { id: ClasseFalta; rotulo: string; cor: string }[] = [
    { id: 'injustificada', rotulo: 'Injustificada', cor: C.amber },
    { id: 'atestado', rotulo: 'Atestado', cor: C.primary },
    { id: 'outro', rotulo: 'Outras', cor: C.slate },
  ];
  const vazio = { faltas: 0, horas: 0 };
  const porTipo = dados.porTipo ?? { atestado: vazio, injustificada: vazio, outro: vazio };
  const pessoas = dados.pessoas ?? [];

  const porMes = useMemo(() => dados.meses.map(m => ({
    mes: rotuloMes(m.mes), taxa: pctDe(m.taxa), headcount: m.headcount, horas: Math.round(m.horasPerdidas),
    injustificada: Math.round(m.porTipo?.injustificada.horas ?? 0), atestado: Math.round(m.porTipo?.atestado.horas ?? 0), outro: Math.round(m.porTipo?.outro.horas ?? 0),
  })), [dados]);
  const porSede = useMemo(() => dados.sedes.filter(s => s.taxa !== null).sort((a, b) => (b.taxa ?? 0) - (a.taxa ?? 0)), [dados]);
  const semana = useMemo(() => (dados.semana ?? []).map(d => ({ dia: d.dia, ...d.contagem })), [dados]);

  const ranking = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const chave = (p: PessoaAbs) => (ordem === 'taxa' ? p.taxa : p.porTipo[ordem].horas);
    return pessoas
      .filter(p => !q || `${p.nome} ${p.matricula} ${p.cargo} ${p.sede}`.toLowerCase().includes(q))
      .sort((a, b) => chave(b) - chave(a) || b.horas - a.horas);
  }, [pessoas, busca, ordem]);
  const visiveis = todas || busca ? ranking : ranking.slice(0, 15);

  const taxa = pctDe(dados.geral.taxa);
  const ultimo = dados.meses[dados.meses.length - 1];
  const totalHoras = TIPOS.reduce((s, t) => s + porTipo[t.id].horas, 0);
  const escopo = dados.instituicao === 'Christus' ? 'Infraestrutura do Colégio' : dados.instituicao === 'Unichristus' ? 'Infraestrutura da Universidade' : 'Infraestrutura, Colégio e Universidade';
  const h = (n: number) => `${num(Math.round(n))} h`;

  function segmentado<T extends string>(atual: T, opcoes: [T, string][], mudar: (v: T) => void, rotulo: string) {
    return (
      <div role="group" aria-label={rotulo} className="inline-flex p-1 bg-slate-100 rounded-lg gap-0.5">
        {opcoes.map(([id, r]) => (
          <button key={id} type="button" aria-pressed={atual === id} onClick={() => mudar(id)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${atual === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{r}</button>
        ))}
      </div>
    );
  }

  const celulaTipo = (t: { faltas: number; horas: number }, destaque: string) => (t.faltas
    ? <><span className={`font-semibold ${destaque}`}>{h(t.horas)}</span><span className="ml-1 text-xs text-slate-500">({t.faltas})</span></>
    : <span className="text-slate-400">—</span>);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Nota className="max-w-3xl">
          {escopo}, do quadro do Chromos. A taxa é a mesma da tela de Absenteísmo de lá: horas perdidas sobre as horas
          esperadas do quadro ativo, sem feriados, com as contestações aceitas fora.
          {sedeFiltrada && ' O filtro de sede acima não se aplica aqui — as sedes do Chromos têm outros códigos.'}
        </Nota>
        <Fonte />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi rotulo="Taxa do período" valor={taxa === null ? '—' : `${dec(taxa)}%`}
          tom={taxa !== null && taxa >= 5 ? 'atencao' : 'neutro'}
          detalhe={taxa === null ? 'sem quadro no período' : `de ${h(dados.geral.horasEsperadas)} esperadas`} />
        <Kpi rotulo="Horas perdidas" valor={num(Math.round(dados.geral.horasPerdidas))} unidade="h"
          detalhe={`${h(porTipo.injustificada.horas)} injustificadas · ${h(porTipo.atestado.horas)} de atestado`} />
        <Kpi rotulo="Pessoas que faltaram" valor={num(pessoas.length)}
          detalhe={ultimo ? `de ${num(ultimo.headcount)} no quadro em ${rotuloMes(ultimo.mes)}` : undefined} />
        <Kpi rotulo="Faltas sem dono" valor={num(dados.semDono)} tom={dados.semDono > 0 ? 'atencao' : 'neutro'}
          detalhe={dados.semDono > 0 ? 'de quem não está no quadro — fora da taxa' : 'todas conciliadas'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Painel titulo="Mês a mês" className="xl:col-span-3"
          descricao={visaoMes === 'taxa' ? 'Percentual das horas esperadas que se perderam em faltas.' : 'Horas perdidas no mês, por tipo de falta.'}
          acoes={segmentado<'taxa' | 'tipo'>(visaoMes, [['tipo', 'Por tipo'], ['taxa', 'Taxa']], setVisaoMes, 'Visão do mês a mês')}>
          {porMes.every(m => m.taxa === null) ? <Vazio>Sem quadro ativo no período.</Vazio> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {visaoMes === 'taxa' ? (
                  <LineChart data={porMes} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} {...grade} />
                    <XAxis dataKey="mes" {...eixo} />
                    <YAxis {...eixo} tickFormatter={v => `${v}%`} />
                    <Tooltip cursor={cursorLinha} content={<Dica sufixo="%" />} />
                    <Line isAnimationActive={false} type="monotone" dataKey="taxa" name="Absenteísmo" stroke={C.primary} strokeWidth={2}
                      connectNulls={false} dot={{ r: 3, strokeWidth: 0, fill: C.primary }} activeDot={{ r: 5 }} />
                  </LineChart>
                ) : (
                  <BarChart data={porMes} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} {...grade} />
                    <XAxis dataKey="mes" {...eixo} />
                    <YAxis {...eixo} tickFormatter={v => num(v)} />
                    <Tooltip cursor={cursorBarra} content={<Dica sufixo=" h" />} />
                    <Legend {...legenda} />
                    {TIPOS.map((t, i) => (
                      <Bar key={t.id} isAnimationActive={false} dataKey={t.id} name={t.rotulo} stackId="h" fill={t.cor}
                        stroke="var(--sgpc-papel)" strokeWidth={1} radius={i === TIPOS.length - 1 ? [3, 3, 0, 0] : 0} />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
          {dados.periodo.ate === dataISOLocal().slice(0, 7) && (
            <Nota className="mt-2">
              {rotuloMes(dados.periodo.ate)} está em curso: as faltas do mês só entram quando o relatório do ERP é publicado no Chromos, então o número dele tende a subir.
            </Nota>
          )}
          <TabelaDoGrafico titulo="Absenteísmo por mês" linhas={porMes}
            colunas={[{ titulo: 'Mês', valor: l => l.mes }, { titulo: 'Taxa', valor: l => (l.taxa === null ? '—' : `${dec(l.taxa)}%`), numerica: true },
              { titulo: 'Injustificada (h)', valor: l => num(l.injustificada), numerica: true }, { titulo: 'Atestado (h)', valor: l => num(l.atestado), numerica: true },
              { titulo: 'Outras (h)', valor: l => num(l.outro), numerica: true }, { titulo: 'Quadro', valor: l => num(l.headcount), numerica: true }]} />
        </Painel>

        <Painel titulo="Tipo de falta" descricao="Como as horas perdidas se dividem." className="xl:col-span-2">
          {totalHoras === 0 ? <Vazio>Nenhuma falta no período.</Vazio> : (
            <>
              <div className="flex h-3 rounded-[4px] overflow-hidden gap-[2px]" aria-hidden="true">
                {TIPOS.filter(t => porTipo[t.id].horas > 0).map(t => (
                  <span key={t.id} style={{ width: `${(porTipo[t.id].horas / totalHoras) * 100}%`, background: t.cor }} />
                ))}
              </div>
              <ul className="mt-4 divide-y divide-slate-100">
                {TIPOS.map(t => (
                  <li key={t.id} className="flex items-baseline gap-3 py-2.5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0 self-center" style={{ background: t.cor }} aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-900 flex-1">{t.rotulo}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{num(porTipo[t.id].faltas)} faltas</span>
                    <span className="w-20 text-right text-sm font-bold tabular-nums text-slate-900">{h(porTipo[t.id].horas)}</span>
                    <span className="w-12 text-right text-xs font-semibold tabular-nums text-slate-600">{Math.round((porTipo[t.id].horas / totalHoras) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Painel>
      </div>

      <Painel titulo="Quem mais falta" descricao="Taxa de cada pessoa sobre as horas dos meses em que ela esteve no quadro."
        acoes={segmentado<'taxa' | 'injustificada' | 'atestado'>(ordem, [['taxa', 'Taxa'], ['injustificada', 'Injustificadas'], ['atestado', 'Atestado']], v => { setOrdem(v); setTodas(false); }, 'Ordenar por')}>
        {pessoas.length === 0 ? <Vazio>Ninguém faltou no período.</Vazio> : (
          <>
            <label className="block mb-3 max-w-xs">
              <span className="sr-only">Buscar pessoa</span>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, matrícula, cargo ou sede…"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md" />
            </label>
            {/* Sem rolagem de lado (regra de 08/10/2026): em tela estreita, cartão. */}
            <div>
              <table className="w-full text-sm tabela-empilha">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th scope="col" className="py-2 pr-3 text-left font-semibold">Pessoa</th>
                    <th scope="col" className="py-2 px-3 text-left font-semibold">Cargo · Sede</th>
                    <th scope="col" className="py-2 px-3 text-right font-semibold">Faltas</th>
                    <th scope="col" className="py-2 px-3 text-right font-semibold">Injustificada</th>
                    <th scope="col" className="py-2 px-3 text-right font-semibold">Atestado</th>
                    <th scope="col" className="py-2 pl-3 text-right font-semibold">Taxa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiveis.map((p, i) => (
                    <tr key={`${p.matricula}-${p.nome}-${i}`} className="hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <span className="font-semibold text-slate-900">{p.nome}</span>
                        {p.matricula && <span className="ml-2 text-xs text-slate-500 tabular-nums">{p.matricula}</span>}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-600" data-rotulo="Cargo · Sede">{[p.cargo, p.sede].filter(Boolean).join(' · ')}</td>
                      <td className="py-2 px-3 text-right tabular-nums" data-rotulo="Faltas">{num(p.faltas)}</td>
                      <td className="py-2 px-3 text-right tabular-nums" data-rotulo="Injustificada">{celulaTipo(p.porTipo.injustificada, 'text-amber-700')}</td>
                      <td className="py-2 px-3 text-right tabular-nums" data-rotulo="Atestado">{celulaTipo(p.porTipo.atestado, 'text-slate-900')}</td>
                      <td className="py-2 pl-3 text-right tabular-nums font-bold text-slate-900" data-rotulo="Taxa">{dec(Math.round(p.taxa * 1000) / 10)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!busca && ranking.length > 15 && (
              <button type="button" onClick={() => setTodas(v => !v)} className="mt-3 text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900 cursor-pointer">
                {todas ? 'Mostrar só as 15 primeiras' : `Mostrar todas as ${num(ranking.length)} pessoas`}
              </button>
            )}
            {busca && ranking.length === 0 && <p className="text-xs text-slate-500 mt-2">Ninguém com esse nome faltou no período.</p>}
          </>
        )}
      </Painel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Painel titulo="Dia da semana" descricao="Quantas faltas caem em cada dia, por tipo.">
          {semana.every(d => !d.atestado && !d.injustificada && !d.outro) ? <Vazio>Nenhuma falta no período.</Vazio> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={semana} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...grade} />
                  <XAxis dataKey="dia" {...eixo} />
                  <YAxis {...eixo} allowDecimals={false} />
                  <Tooltip cursor={cursorBarra} content={<Dica />} />
                  {TIPOS.map((t, i) => (
                    <Bar key={t.id} isAnimationActive={false} dataKey={t.id} name={t.rotulo} stackId="d" fill={t.cor}
                      stroke="var(--sgpc-papel)" strokeWidth={1} radius={i === TIPOS.length - 1 ? [3, 3, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Painel>

        <Painel titulo="Por sede" descricao="Códigos de sede do Chromos.">
          {porSede.length === 0 ? <Vazio>Nenhuma sede com quadro no período.</Vazio> : (
            <ListaComBarra sufixo="%" itens={porSede.map(s => ({
              nome: s.regiao && s.regiao !== s.sede ? `${s.sede} · ${s.regiao}` : s.sede,
              valor: pctDe(s.taxa) ?? 0,
              detalhe: h(s.horasPerdidas),
            }))} />
          )}
        </Painel>
      </div>
    </div>
  );
};
