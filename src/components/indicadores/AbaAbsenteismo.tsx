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
import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAbsenteismo, type Absenteismo } from '../../hooks/useAbsenteismo';
import { dataISOLocal } from '../../utils/date';
import { MESES_CURTOS, type Periodo } from '../../utils/filtroIndicadores';
import { TabelaDoGrafico } from '../TabelaDoGrafico';
import { Painel, Kpi, Nota, Vazio, Dica, ListaComBarra, useEixos, num, dec } from './ui';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
  const { C, grade, eixo, cursorLinha } = useEixos();
  const porMes = useMemo(() => dados.meses.map(m => ({ mes: rotuloMes(m.mes), taxa: pctDe(m.taxa), headcount: m.headcount, horas: Math.round(m.horasPerdidas) })), [dados]);
  const porSede = useMemo(() => dados.sedes.filter(s => s.taxa !== null).sort((a, b) => (b.taxa ?? 0) - (a.taxa ?? 0)), [dados]);
  const taxa = pctDe(dados.geral.taxa);
  const ultimo = dados.meses[dados.meses.length - 1];
  const escopo = dados.instituicao === 'Christus' ? 'Infraestrutura do Colégio' : dados.instituicao === 'Unichristus' ? 'Infraestrutura da Universidade' : 'Infraestrutura, Colégio e Universidade';

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
          detalhe={taxa === null ? 'sem quadro no período' : `de ${num(Math.round(dados.geral.horasEsperadas))} h esperadas`} />
        <Kpi rotulo="Horas perdidas" valor={num(Math.round(dados.geral.horasPerdidas))} unidade="h" />
        <Kpi rotulo="Quadro" valor={ultimo ? num(ultimo.headcount) : '—'} detalhe={ultimo ? `ativos em ${rotuloMes(ultimo.mes)}` : undefined} />
        <Kpi rotulo="Faltas sem dono" valor={num(dados.semDono)} tom={dados.semDono > 0 ? 'atencao' : 'neutro'}
          detalhe={dados.semDono > 0 ? 'de quem não está no quadro — fora da taxa' : 'todas conciliadas'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Painel titulo="Taxa mês a mês" descricao="Percentual das horas esperadas que se perderam em faltas." className="xl:col-span-3">
          {porMes.every(m => m.taxa === null) ? <Vazio>Sem quadro ativo no período.</Vazio> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={porMes} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...grade} />
                  <XAxis dataKey="mes" {...eixo} />
                  <YAxis {...eixo} tickFormatter={v => `${v}%`} />
                  <Tooltip cursor={cursorLinha} content={<Dica sufixo="%" />} />
                  <Line isAnimationActive={false} type="monotone" dataKey="taxa" name="Absenteísmo" stroke={C.primary} strokeWidth={2}
                    connectNulls={false} dot={{ r: 3, strokeWidth: 0, fill: C.primary }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {dados.periodo.ate === dataISOLocal().slice(0, 7) && (
            <Nota className="mt-2">
              {rotuloMes(dados.periodo.ate)} está em curso: as faltas do mês só entram quando o relatório do ERP é publicado no Chromos, então a taxa dele tende a subir.
            </Nota>
          )}
          <TabelaDoGrafico titulo="Absenteísmo por mês" linhas={porMes}
            colunas={[{ titulo: 'Mês', valor: l => l.mes }, { titulo: 'Taxa', valor: l => (l.taxa === null ? '—' : `${dec(l.taxa)}%`), numerica: true },
              { titulo: 'Horas perdidas', valor: l => num(l.horas), numerica: true }, { titulo: 'Quadro', valor: l => num(l.headcount), numerica: true }]} />
        </Painel>

        <Painel titulo="Por sede" descricao="Códigos de sede do Chromos." className="xl:col-span-2">
          {porSede.length === 0 ? <Vazio>Nenhuma sede com quadro no período.</Vazio> : (
            <ListaComBarra sufixo="%" itens={porSede.map(s => ({
              nome: s.regiao && s.regiao !== s.sede ? `${s.sede} · ${s.regiao}` : s.sede,
              valor: pctDe(s.taxa) ?? 0,
              detalhe: `${num(Math.round(s.horasPerdidas))} h`,
            }))} />
          )}
        </Painel>
      </div>
    </div>
  );
};
