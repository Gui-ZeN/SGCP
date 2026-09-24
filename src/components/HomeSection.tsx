import React from 'react';
import { Vaga, Treinamento, Experiencia, Entrevista, Turnover, Selecao, Requisicao, Consulta } from '../types';
import { SLA_META_DIAS } from '../constants/hr';
import { Sede } from '../hooks/useMetadata';
import { ProximasDatasCard } from './ProximasDatasCard';
import { SetembroAmarelo } from './SetembroAmarelo';
import { pendenciasDoDia, quandoVence } from '../utils/inicio';
import { ehRealizada } from '../utils/selecao';
import { formatDateBR, dataISOLocal } from '../utils/date';
import { ArrowRight, NotebookPen } from 'lucide-react';

/**
 * Início — "o que fazer hoje" (repaginado em 24/09/2026). Antes era vitrine:
 * saudação com gradiente, quatro cartões de número e atalhos. Agora a página
 * responde à pergunta de quem abre o sistema de manhã: o que pede ação agora.
 * As frentes vêm em ordem de urgência e só aparecem quando têm item.
 */
interface HomeSectionProps {
  vagas: Vaga[];
  treinamentos: Treinamento[];
  experiencias: Experiencia[];
  entrevistas: Entrevista[];
  turnover: Turnover[];
  /** Ausente = o perfil não vê o módulo; a frente some. */
  selecoes?: Selecao[];
  requisicoes?: Requisicao[];
  consultas?: Consulta[];
  /** Mostra o botão "Registrar meu dia" (Resumo do Dia). */
  podeRegistrarDia?: boolean;
  mostrarSetembroAmarelo?: boolean; // enfeite sazonal (Painel Admin → Enfeites)
  setActiveTab: (tab: any) => void;
  onFocusVaga?: (vaga: any) => void;
  userName?: string;
  sedes?: Sede[];
  userSede?: string;
  isAdmin?: boolean;
}

type Tom = 'critico' | 'atencao' | 'acento' | 'neutro';
const COR: Record<Tom, string> = {
  critico: 'text-rose-700',
  atencao: 'text-amber-700',
  acento: 'text-indigo-700',
  neutro: 'text-slate-900',
};
const VISIVEIS = 4;

interface Item { id: string; principal: string; meta: string; quando: string; tom?: Tom; abrir: () => void }
interface Frente { id: string; titulo: string; detalhe: string; tom: Tom; itens: Item[]; verTudo: () => void }

export const HomeSection: React.FC<HomeSectionProps> = ({
  vagas,
  treinamentos,
  experiencias,
  entrevistas,
  selecoes,
  requisicoes,
  consultas,
  podeRegistrarDia = false,
  mostrarSetembroAmarelo = false,
  setActiveTab,
  onFocusVaga,
  userName,
  sedes = [],
  userSede,
  isAdmin = false
}) => {
  const filteredVagas = React.useMemo(() => {
    if (!isAdmin && userSede) {
      return vagas.filter(v => v.sede && v.sede.toLowerCase() === userSede.toLowerCase());
    }
    return vagas;
  }, [vagas, isAdmin, userSede]);

  const sigla = (nome: string) => {
    const s = sedes.find(x => x.nome.toLowerCase() === (nome || '').toLowerCase());
    return s?.sigla || nome;
  };

  const hojeISO = dataISOLocal();
  const hojeBR = formatDateBR(hojeISO);
  const p = React.useMemo(
    () => pendenciasDoDia({ hojeISO, hojeBR, vagas: filteredVagas, experiencias, selecoes, requisicoes, consultas }),
    [hojeISO, hojeBR, filteredVagas, experiencias, selecoes, requisicoes, consultas]
  );

  const todas: Frente[] = [
    {
      id: 'sem-confirmar', titulo: 'Seleções sem confirmar', tom: 'critico',
      detalhe: 'Agendadas que já passaram. Lance quem veio.',
      verTudo: () => setActiveTab('selecoes'),
      itens: p.selecoesSemConfirmar.map(s => ({
        id: s.id, principal: s.cargo, meta: `${sigla(s.sede)} · ${s.convocados} convocados`,
        quando: `dia ${s.data.slice(0, 5)}`, tom: 'critico' as Tom, abrir: () => setActiveTab('selecoes'),
      })),
    },
    {
      id: 'hoje', titulo: 'Seleções de hoje', tom: 'acento',
      detalhe: 'Depois da seleção, lance o resultado de cada candidato.',
      verTudo: () => setActiveTab('selecoes'),
      itens: p.selecoesHoje.map(s => ({
        id: s.id, principal: s.cargo, meta: [sigla(s.sede), `${s.convocados} convocados`, s.responsavel].filter(Boolean).join(' · '),
        quando: 'hoje', tom: 'acento' as Tom, abrir: () => setActiveTab('selecoes'),
      })),
    },
    {
      id: 'avaliacoes', titulo: 'Avaliações de experiência', tom: p.avaliacoes.some(x => x.dias < 0) ? 'critico' : 'atencao',
      detalhe: 'Marcos de 45 e 90 dias vencidos ou vencendo nesta semana.',
      verTudo: () => setActiveTab('experiencias'),
      itens: p.avaliacoes.map(({ e, marco, dias }) => ({
        id: e.id, principal: e.colaborador, meta: [marco, e.funcao, e.sede ? sigla(e.sede) : ''].filter(Boolean).join(' · '),
        quando: quandoVence(dias), tom: (dias < 0 ? 'critico' : dias <= 2 ? 'atencao' : 'neutro') as Tom,
        abrir: () => setActiveTab('experiencias'),
      })),
    },
    {
      id: 'requisicoes', titulo: 'Requisições para decidir', tom: 'acento',
      detalhe: 'Pedidos de vaga enviados pelos gestores.',
      verTudo: () => setActiveTab('requisicoes'),
      itens: p.requisicoes.map(({ r, dias }) => ({
        id: r.id, principal: r.cargo, meta: [sigla(r.sede), r.gestorSolicitante].filter(Boolean).join(' · '),
        quando: dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`, tom: (dias > 7 ? 'atencao' : 'neutro') as Tom,
        abrir: () => setActiveTab('requisicoes'),
      })),
    },
    {
      id: 'vagas', titulo: 'Vagas fora do prazo', tom: 'atencao',
      detalhe: `Abertas há mais de ${SLA_META_DIAS} dias.`,
      verTudo: () => setActiveTab('vagas'),
      itens: p.vagasForaDoPrazo.map(({ v, dias }) => ({
        id: v.id, principal: v.vaga, meta: [`#${v.codigo}`, sigla(v.sede), v.setor].filter(Boolean).join(' · '),
        quando: `${dias} dias`, tom: (dias > 60 ? 'critico' : 'atencao') as Tom,
        abrir: () => (onFocusVaga ? onFocusVaga(v) : setActiveTab('vagas')),
      })),
    },
    {
      id: 'consultas', titulo: 'Consultas no aguardo', tom: 'neutro',
      detalhe: 'Solicitações de funcionários ainda sem atendimento.',
      verTudo: () => setActiveTab('consultas'),
      itens: p.consultas.map(c => ({
        id: c.id, principal: c.funcionario, meta: c.especialidade,
        quando: `desde ${c.dataSolicitacao.slice(0, 5)}`, abrir: () => setActiveTab('consultas'),
      })),
    },
  ];
  const frentes = todas.filter(f => f.itens.length > 0);

  // ── em números (o retrato de sempre, agora coadjuvante) ──
  const vagasAbertas = filteredVagas.filter(v => ['ABERTA', 'REABERTA'].includes((v.status || '').toUpperCase())).length;
  const emExperiencia = experiencias.filter(e => ['EM_ANALISE', 'PRORROGADO'].includes(e.status)).length;
  const mesBR = hojeBR.slice(3);
  const selecoesDoMes = (selecoes || []).filter(s => ehRealizada(s) && (s.data || '').slice(3) === mesBR);
  const treinados = treinamentos.reduce((a, t) => a + (t.qtdRealizada || 0), 0);
  const clima = entrevistas.length
    ? (entrevistas.reduce((a, e) => a + (e.notaClimaOrg || 0), 0) / entrevistas.length).toFixed(1).replace('.', ',')
    : '—';
  const mesLongo = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  const numeros: { rotulo: string; valor: string; detalhe?: string; tab: string }[] = [
    { rotulo: 'Vagas em aberto', valor: String(vagasAbertas), tab: 'vagas' },
    { rotulo: 'Em período de experiência', valor: String(emExperiencia), tab: 'experiencias' },
    ...(selecoes ? [{
      rotulo: `Seleções em ${mesLongo}`, valor: String(selecoesDoMes.length),
      detalhe: `${selecoesDoMes.reduce((t, s) => t + (s.convocados || 0), 0).toLocaleString('pt-BR')} convocados`, tab: 'selecoesLista',
    }] : []),
    { rotulo: 'Participações em treinamentos', valor: treinados.toLocaleString('pt-BR'), tab: 'treinamentos' },
    { rotulo: 'Clima médio nas saídas', valor: clima, detalhe: 'de 5', tab: 'entrevistas' },
  ];

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = (userName || '').trim().split(/\s+/)[0];
  const hojeLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      {mostrarSetembroAmarelo && <SetembroAmarelo />}

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-5 border-b border-slate-200">
        <div className="min-w-0">
          <h1 className="text-[28px] md:text-[34px] leading-tight font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            {saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}.
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            <span className="first-letter:uppercase inline-block">{hojeLabel}</span>
            <span className="text-slate-400" aria-hidden="true"> · </span>
            {frentes.length === 0 ? 'nada pendente por aqui' : `${frentes.length} ${frentes.length === 1 ? 'frente pede' : 'frentes pedem'} atenção`}
          </p>
        </div>
        {podeRegistrarDia && (
          <button type="button" onClick={() => setActiveTab('selecoes')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer transition-colors">
            <NotebookPen className="w-4 h-4" aria-hidden="true" />
            Registrar meu dia
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section aria-labelledby="para-hoje" className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 min-w-0">
          <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-200">
            <h2 id="para-hoje" className="text-base font-bold text-slate-900">Para hoje</h2>
            {frentes.length > 0 && (
              <span className="text-xs font-medium text-slate-500">em ordem de urgência</span>
            )}
          </header>

          {frentes.length === 0 ? (
            <div className="px-5 py-10">
              <p className="text-sm font-semibold text-slate-900">Nada pendente para hoje.</p>
              <p className="mt-1 text-sm text-slate-600 max-w-prose">
                Nenhuma seleção por confirmar, avaliação vencendo ou vaga fora do prazo.
                {podeRegistrarDia && ' Bom momento para registrar o seu dia.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {frentes.map(f => (
                <li key={f.id} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-x-6 gap-y-2 px-5 py-4">
                  <div className="flex sm:block items-baseline gap-3">
                    <p className={`text-[32px] leading-none font-bold tabular-nums tracking-tight ${COR[f.tom]}`}>{f.itens.length}</p>
                    <div className="sm:mt-2 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 leading-snug">{f.titulo}</h3>
                      <p className="hidden sm:block mt-0.5 text-xs text-slate-500 leading-snug">{f.detalhe}</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <ul>
                      {f.itens.slice(0, VISIVEIS).map(it => (
                        <li key={it.id}>
                          <button type="button" onClick={it.abrir}
                            className="w-full flex items-baseline gap-3 -mx-2 px-2 py-1.5 rounded-md text-left hover:bg-slate-50 cursor-pointer transition-colors group">
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-sm font-semibold text-slate-900 group-hover:underline underline-offset-2">{it.principal}</span>
                              {it.meta && <span className="ml-2 text-xs text-slate-500">{it.meta}</span>}
                            </span>
                            <span className={`shrink-0 text-xs font-semibold tabular-nums ${COR[it.tom || 'neutro']}`}>{it.quando}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {f.itens.length > VISIVEIS && (
                      <button type="button" onClick={f.verTudo}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer">
                        Ver todas as {f.itens.length} <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="lg:col-span-4 space-y-6 min-w-0">
          <section aria-labelledby="em-numeros" className="bg-white rounded-2xl border border-slate-200">
            <h2 id="em-numeros" className="px-5 pt-4 pb-3 text-base font-bold text-slate-900 border-b border-slate-200">Em números</h2>
            <ul className="divide-y divide-slate-200">
              {numeros.map(n => (
                <li key={n.rotulo}>
                  <button type="button" onClick={() => setActiveTab(n.tab)}
                    className="w-full flex items-baseline justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50 cursor-pointer transition-colors group">
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">{n.rotulo}</span>
                    <span className="shrink-0 text-right">
                      <span className="text-lg font-bold tabular-nums text-slate-900">{n.valor}</span>
                      {n.detalhe && <span className="ml-1.5 text-xs text-slate-500">{n.detalhe}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Próximas datas (API de Calendários — some se não configurada) */}
          <ProximasDatasCard />
        </aside>
      </div>
    </div>
  );
};
