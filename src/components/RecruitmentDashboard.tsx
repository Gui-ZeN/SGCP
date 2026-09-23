/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Indicadores — repaginado em 23/09/2026, a pedido do RH ("visualmente muito
 * fracos", filtro de sede "todo bugado").
 *
 * Decisões:
 *  - leitor = o RH no dia a dia: primeiro o que precisa de ação, depois o
 *    detalhe por tema;
 *  - ABAS por tema (Visão geral · Vagas · Seleções · Pessoas · Clima &
 *    Turnover) no lugar dos 12 blocos em sequência;
 *  - SEDE e PERÍODO valem para todos os módulos (antes só para vagas), com a
 *    sede resolvida pelo cadastro (utils/filtroIndicadores): o filtro antigo
 *    comparava texto cru e escondia as vagas "DIONISIO TORRES" ao escolher "DT";
 *  - tema Suíço refinado: as peças em ./indicadores/ui.
 *
 * O nome do componente ficou `RecruitmentDashboard` para o App não mudar.
 */
import React, { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import type { Vaga, Treinamento, Experiencia, Entrevista, Turnover, Integracao, Selecao } from '../types';
import type { Sede } from '../hooks/useMetadata';
import { SLA_META_DIAS } from '../constants/hr';
import { getDiasEmAberto } from '../utils/vaga';
import { estaAtrasada } from '../utils/selecao';
import { indicadoresSelecao, taxaTurnover } from '../utils/indicadores';
import { formatDateBR, dataISOLocal } from '../utils/date';
import {
  opcoesDeSede, naSede, siglaDaSede, anoMes, anoMesDeMesAno, noPeriodo, anosDosDados, rotuloDoPeriodo,
  MESES_LONGOS, type Periodo,
} from '../utils/filtroIndicadores';
import { RelatorioIndicadores } from './RelatorioSection';
import { AbaVisaoGeral, type AbaId, type ItemDeAtencao, type ResumoDoTema } from './indicadores/AbaVisaoGeral';
import { AbaVagas } from './indicadores/AbaVagas';
import { AbaSelecoes } from './indicadores/AbaSelecoes';
import { AbaPessoas, avaliacoesAVencer, LIMITE_ATRASO_DIAS } from './indicadores/AbaPessoas';
import { AbaClima } from './indicadores/AbaClima';
import { num, dec, pct } from './indicadores/ui';

interface RecruitmentDashboardProps {
  vagas: Vaga[];
  treinamentos?: Treinamento[];
  experiencias?: Experiencia[];
  entrevistas?: Entrevista[];
  turnover?: Turnover[];
  integracoes?: Integracao[];
  mostrarIntegracao?: boolean;
  sedes?: Sede[];
  userSede?: string;
  isAdmin?: boolean;
  /** Dias de seleção (abas QUANTI + os lançados no sistema). */
  selecoes?: Selecao[];
}

const ABAS: { id: AbaId; rotulo: string }[] = [
  { id: 'geral', rotulo: 'Visão geral' },
  { id: 'vagas', rotulo: 'Vagas' },
  { id: 'selecoes', rotulo: 'Seleções' },
  { id: 'pessoas', rotulo: 'Pessoas' },
  { id: 'clima', rotulo: 'Clima & Turnover' },
];
const EM_ANDAMENTO = ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'];

const campoFiltro = 'text-sm bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 font-semibold text-slate-800 outline-none focus:border-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';

export const RecruitmentDashboard: React.FC<RecruitmentDashboardProps> = ({
  vagas, treinamentos = [], experiencias = [], entrevistas = [], turnover = [], integracoes = [],
  mostrarIntegracao = false, sedes = [], selecoes = [], userSede, isAdmin = false,
}) => {
  const [aba, setAba] = useState<AbaId>('geral');

  // ── filtros ──────────────────────────────────────────────────────────────
  // Quem não é admin vê a própria sede (como antes), já pela sigla do cadastro.
  const sedeTravada = !isAdmin && !!userSede;
  const [sede, setSede] = useState<string | null>(() => (sedeTravada ? siglaDaSede(sedes, userSede) || userSede! : null));
  const opcoes = useMemo(() => opcoesDeSede(sedes, [
    ...vagas.map(v => v.sede), ...selecoes.map(s => s.sede), ...treinamentos.map(t => t.unidade),
    ...experiencias.map(e => e.sede), ...integracoes.map(i => i.sede), ...entrevistas.map(e => e.unidade),
  ]), [sedes, vagas, selecoes, treinamentos, experiencias, integracoes, entrevistas]);

  const anos = useMemo(() => anosDosDados([
    ...vagas.map(v => v.solicitacao), ...selecoes.map(s => s.data), ...treinamentos.map(t => t.dataInicio), ...turnover.map(t => t.mesAno),
  ]), [vagas, selecoes, treinamentos, turnover]);
  const anoAtual = new Date().getFullYear();
  // Abre no ano corrente (ou no mais recente com dado): é o que o RH olha.
  const [periodo, setPeriodoBruto] = useState<Periodo>(() => ({ ano: anos.includes(anoAtual) ? anoAtual : (anos[0] ?? null), mes: null }));
  // Os dados chegam do Firestore DEPOIS do primeiro render: sem isto, o ano
  // padrão nascia de uma lista vazia e a tela abria em "todo o período". Só
  // enquanto a pessoa não escolheu nada.
  const escolheuPeriodo = React.useRef(false);
  const setPeriodo: typeof setPeriodoBruto = v => { escolheuPeriodo.current = true; setPeriodoBruto(v); };
  React.useEffect(() => {
    if (escolheuPeriodo.current || !anos.length) return;
    const padrao = anos.includes(anoAtual) ? anoAtual : anos[0];
    setPeriodoBruto(p => (p.ano === padrao ? p : { ano: padrao, mes: null }));
  }, [anos, anoAtual]);

  const daSede = useMemo(() => naSede(sedes, sede), [sedes, sede]);
  const f = useMemo(() => {
    const noP = (d?: string) => noPeriodo(periodo, anoMes(d));
    const integSede = integracoes.filter(i => daSede(i.sede));
    return {
      vagas: vagas.filter(v => daSede(v.sede)),
      selecoes: selecoes.filter(s => daSede(s.sede) && noP(s.data)),
      selecoesSede: selecoes.filter(s => daSede(s.sede)),
      treinamentos: treinamentos.filter(t => daSede(t.unidade) && noP(t.dataInicio)),
      experiencias: experiencias.filter(e => daSede(e.sede) && noP(e.dataAdmissao)),
      experienciasSede: experiencias.filter(e => daSede(e.sede)),
      integracoes: integSede.filter(i => noP(i.admissao)),
      integracoesSemData: integSede.filter(i => !anoMes(i.admissao)).length,
      entrevistas: entrevistas.filter(e => daSede(e.unidade) && noP(e.dataEntrevista)),
      // Turnover não tem sede: só o período.
      turnover: turnover.filter(t => noPeriodo(periodo, anoMesDeMesAno(t.mesAno))),
    };
  }, [vagas, selecoes, treinamentos, experiencias, integracoes, entrevistas, turnover, daSede, periodo]);

  // ── visão geral ──────────────────────────────────────────────────────────
  const geral = useMemo(() => {
    const abertas = f.vagas.filter(v => EM_ANDAMENTO.includes((v.status || '').toUpperCase()));
    const atrasadasVaga = abertas.map(v => ({ v, d: getDiasEmAberto(v) })).filter(x => x.d > SLA_META_DIAS).sort((a, b) => b.d - a.d);
    const fechadas = f.vagas.filter(v => (v.status || '').toUpperCase() === 'FECHADA' && noPeriodo(periodo, anoMes(v.conclusao)));
    const comTempo = fechadas.filter(v => (v.tempoProcesso || 0) > 0);
    const tempo = comTempo.length ? Math.round(comTempo.reduce((t, v) => t + (v.tempoProcesso || 0), 0) / comTempo.length) : null;

    const sel = indicadoresSelecao(f.selecoes);
    const hojeBR = formatDateBR(dataISOLocal());
    const semConfirmar = f.selecoesSede.filter(s => estaAtrasada(s, hojeBR));

    const aVencer = avaliacoesAVencer(f.experienciasSede, 7);
    const atrasadasExp = aVencer.filter(x => x.dias < 0 && x.dias >= -LIMITE_ATRASO_DIAS);
    const semDesfecho = aVencer.filter(x => x.dias < -LIMITE_ATRASO_DIAS).length;
    const treinados = f.treinamentos.reduce((t, x) => t + (x.qtdRealizada || 0), 0);
    const previstos = f.treinamentos.reduce((t, x) => t + (x.qtdPrevista || 0), 0);
    const efetivados = f.experiencias.filter(e => e.status === 'EFETIVADO').length;
    const pendInteg = f.integracoes.filter(i => i.status === 'Não realizado').length;

    const turn = taxaTurnover(f.turnover);
    const adm = f.turnover.reduce((t, x) => t + (x.totalAdmissao || 0), 0);
    const saidas = f.turnover.reduce((t, x) => t + (x.pediramSair || 0) + (x.foramDesligados || 0), 0);

    const atencao: ItemDeAtencao[] = [];
    if (atrasadasExp.length) atencao.push({ id: 'exp-atrasada', gravidade: 'critico', aba: 'pessoas',
      texto: `${atrasadasExp.length} avaliação(ões) de experiência atrasada(s)`,
      detalhe: atrasadasExp.slice(0, 3).map(x => `${x.e.colaborador} (${x.marco}, ${-x.dias} d)`).join(' · ') });
    if (atrasadasVaga.length) atencao.push({ id: 'vaga-prazo', gravidade: atrasadasVaga.length > 10 ? 'critico' : 'atencao', aba: 'vagas',
      texto: `${atrasadasVaga.length} vaga(s) em aberto há mais de ${SLA_META_DIAS} dias`,
      detalhe: atrasadasVaga.slice(0, 3).map(x => `#${x.v.codigo} ${x.v.vaga} · ${x.d} d`).join(' · ') });
    if (semConfirmar.length) atencao.push({ id: 'sel-confirmar', gravidade: 'atencao', aba: 'selecoes',
      texto: `${semConfirmar.length} seleção(ões) passaram sem confirmar quem compareceu`,
      detalhe: 'Confirme na aba Resumo do Dia — até lá, ficam fora dos números.' });
    if (semDesfecho) atencao.push({ id: 'exp-sem-desfecho', gravidade: 'atencao', aba: 'pessoas',
      texto: `${semDesfecho} experiência(s) sem desfecho lançado há mais de ${LIMITE_ATRASO_DIAS} dias`,
      detalhe: 'O prazo já passou faz tempo: é efetivar ou encerrar na aba Experiência.' });
    const proximas = aVencer.filter(x => x.dias >= 0);
    if (proximas.length) atencao.push({ id: 'exp-proximas', gravidade: 'atencao', aba: 'pessoas',
      texto: `${proximas.length} avaliação(ões) de experiência nos próximos 7 dias`,
      detalhe: proximas.slice(0, 3).map(x => `${x.e.colaborador} · ${x.dias === 0 ? 'hoje' : `em ${x.dias} d`}`).join(' · ') });
    if (mostrarIntegracao && pendInteg) atencao.push({ id: 'integ', gravidade: 'atencao', aba: 'pessoas',
      texto: `${pendInteg} integração(ões) pendente(s)`, detalhe: 'Admitidos no período que ainda não fizeram a integração.' });
    if (previstos && pct(treinados, previstos) < 70) atencao.push({ id: 'trein', gravidade: 'atencao', aba: 'pessoas',
      texto: `Aproveitamento dos treinamentos em ${pct(treinados, previstos)}%`, detalhe: `${num(treinados)} presentes de ${num(previstos)} previstos.` });

    const temas: ResumoDoTema[] = [
      { aba: 'vagas', titulo: 'Vagas', principal: { valor: num(abertas.length), rotulo: 'em aberto agora' },
        apoio: [{ valor: num(fechadas.length), rotulo: 'fechadas no período' }, { valor: tempo !== null ? `${tempo} d` : '—', rotulo: 'tempo médio de fechamento' }] },
      { aba: 'selecoes', titulo: 'Seleções', principal: { valor: sel.convocados ? `${sel.taxaComparecimento}%` : '—', rotulo: 'dos convocados compareceram' },
        apoio: [{ valor: num(sel.convocados), rotulo: 'convocados' }, { valor: sel.contratacao ? num(sel.contratacao.contratados) : '—', rotulo: 'contratados (Geral)' }] },
      { aba: 'pessoas', titulo: 'Pessoas', principal: { valor: num(treinados), rotulo: 'pessoas treinadas' },
        apoio: [{ valor: num(efetivados), rotulo: 'efetivados na experiência' }, { valor: num(atrasadasExp.length), rotulo: 'avaliações de experiência atrasadas' }] },
      { aba: 'clima', titulo: 'Clima & Turnover', principal: { valor: turn.temDados ? `${dec(turn.taxa)}%` : '—', rotulo: turn.temDados ? `turnover de ${turn.mesAno}` : 'turnover (sem mês lançado)' },
        apoio: [{ valor: num(adm), rotulo: 'admissões' }, { valor: num(saidas), rotulo: 'saídas' }] },
    ];
    return { atencao, temas };
  }, [f, periodo, mostrarIntegracao]);

  const rotuloSede = sede ? (opcoes.find(o => o.valor === sede)?.rotulo || sede) : 'Todas as sedes';

  return (
    <div className="space-y-6">
      {/* Cabeçalho: o que é, o recorte, e os filtros numa linha só */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Indicadores</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {rotuloSede} · {rotuloDoPeriodo(periodo)}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Sede</span>
            <select value={sede ?? ''} disabled={sedeTravada} onChange={e => setSede(e.target.value || null)} className={campoFiltro}>
              <option value="">Todas as sedes</option>
              {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Ano</span>
            <select value={periodo.ano ?? ''} onChange={e => setPeriodo({ ano: e.target.value ? Number(e.target.value) : null, mes: null })} className={campoFiltro}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
              <option value="">Todo o período</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Mês</span>
            <select value={periodo.mes ?? ''} disabled={periodo.ano === null}
              onChange={e => setPeriodo(p => ({ ...p, mes: e.target.value ? Number(e.target.value) : null }))} className={campoFiltro}>
              <option value="">Ano inteiro</option>
              {MESES_LONGOS.map((m, i) => <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </label>
          <button onClick={() => window.print()} title="Gerar PDF (pela impressão do navegador)"
            className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
            <Printer className="w-4 h-4" aria-hidden="true" /> Exportar PDF
          </button>
        </div>
      </header>

      {/* Capa do PDF */}
      <div className="print-only mb-2 border-b-2 border-slate-900 pb-3">
        <div className="text-2xl font-bold text-slate-900">Indicadores · RH</div>
        <div className="text-sm text-slate-500 font-semibold">{rotuloSede} · {rotuloDoPeriodo(periodo)} · gerado em {new Date().toLocaleDateString('pt-BR')}</div>
      </div>

      <nav role="tablist" aria-label="Temas dos indicadores" className="no-print flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ABAS.map(a => (
          <button key={a.id} role="tab" type="button" aria-selected={aba === a.id} aria-controls={`painel-${a.id}`} id={`aba-${a.id}`}
            onClick={() => setAba(a.id)}
            className={`shrink-0 px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px cursor-pointer transition-colors ${
              aba === a.id ? 'border-[var(--sgpc-acento,#1B4DD8)] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {a.rotulo}
          </button>
        ))}
      </nav>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        {aba === 'geral' && <AbaVisaoGeral atencao={geral.atencao} temas={geral.temas} irPara={setAba} />}
        {aba === 'vagas' && <AbaVagas vagas={f.vagas} sedes={sedes} periodo={periodo} />}
        {aba === 'selecoes' && <AbaSelecoes selecoes={f.selecoes} sedes={sedes} periodo={periodo} />}
        {aba === 'pessoas' && (
          <div className="space-y-8">
            <AbaPessoas treinamentos={f.treinamentos} experiencias={f.experiencias} experienciasEmCurso={f.experienciasSede}
              integracoes={f.integracoes} integracoesSemData={f.integracoesSemData} mostrarIntegracao={mostrarIntegracao}
              sedes={sedes} periodo={periodo} />
            {/* Cumprimento por sede, no formato do relatório mensal — tem o próprio filtro de mês. */}
            <RelatorioIndicadores
              integracoes={integracoes.filter(i => daSede(i.sede))}
              treinamentos={treinamentos.filter(t => daSede(t.unidade))}
              experiencias={experiencias.filter(e => daSede(e.sede))}
              mostrarIntegracao={mostrarIntegracao}
            />
          </div>
        )}
        {aba === 'clima' && <AbaClima turnover={f.turnover} entrevistas={f.entrevistas} sedeFiltrada={!!sede} />}
      </div>
    </div>
  );
};
