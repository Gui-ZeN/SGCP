import React from 'react';
import { Vaga, Treinamento, Experiencia, Entrevista, Turnover, Selecao, Requisicao, Consulta } from '../types';
import { SLA_META_DIAS } from '../constants/hr';
import { Sede } from '../hooks/useMetadata';
import { ProximasDatasCard } from './ProximasDatasCard';
import { SetembroAmarelo } from './SetembroAmarelo';
import { OutubroRosa } from './OutubroRosa';
import { pendenciasDoDia, quandoVence } from '../utils/inicio';
import { ehRealizada } from '../utils/selecao';
import { formatDateBR, dataISOLocal, toISOInput } from '../utils/date';
import { linkPara, type Aba } from '../lib/rotas';
import { ReguaFunil, funilDasVagas } from './vagas/ReguaFunil';
import { ArrowRight, NotebookPen } from 'lucide-react';

/**
 * Início — "o que fazer hoje" (repaginado em 24/09/2026). Antes era vitrine:
 * saudação com gradiente, quatro cartões de número e atalhos. Agora a página
 * responde à pergunta de quem abre o sistema de manhã: o que pede ação agora.
 * As frentes vêm em ordem de urgência e só aparecem quando têm item.
 *
 * Rework 10/2026: cada item é um LINK para o lugar exato (a vaga aberta, a
 * pessoa na Experiência, o dia da seleção) — a RH não procura de novo o que o
 * sistema já sabe. A régua do funil é a mesma do Quadro de Vagas.
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
  /** Para onde levam as seleções pendentes: Resumo do Dia (Colégio) ou o módulo Seleções (Universidade). */
  abaSelecoes?: 'selecoes' | 'selecoesLista';
  mostrarSetembroAmarelo?: boolean; // enfeite sazonal (Painel Admin → Enfeites)
  mostrarOutubroRosa?: boolean;
  userName?: string;
  sedes?: Sede[];
  userSede?: string;
  isAdmin?: boolean;
}

type Tom = 'critico' | 'atencao' | 'acento' | 'neutro';
/** Tokens de ui.css: o vermelho é o de atraso; o resto, tinta e cores de etapa. */
const COR: Record<Tom, string> = {
  critico: 'var(--atraso)',
  atencao: 'var(--etapa-triagem)',
  acento: 'var(--etapa-entrevista)',
  neutro: 'var(--tinta)',
};
const VISIVEIS = 4;

interface Item { id: string; principal: string; meta: string; quando: string; tom?: Tom; href: string }
interface Frente { id: string; titulo: string; detalhe: string; tom: Tom; itens: Item[]; verTudo: string }

export const HomeSection: React.FC<HomeSectionProps> = ({
  vagas,
  treinamentos,
  experiencias,
  entrevistas,
  selecoes,
  requisicoes,
  consultas,
  podeRegistrarDia = false,
  abaSelecoes = 'selecoes',
  mostrarSetembroAmarelo = false,
  mostrarOutubroRosa = false,
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
  const funil = React.useMemo(() => funilDasVagas(filteredVagas), [filteredVagas]);

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

  // Cada seleção abre no dia dela (Resumo do Dia) ou nela mesma (Seleções), não na tela vazia.
  const linkDaSelecao = (sel: Selecao) => abaSelecoes === 'selecoes'
    ? linkPara('selecoes', { dia: toISOInput(sel.data) })
    : linkPara('selecoesLista', { selecao: sel.id });

  const todas: Frente[] = [
    {
      id: 'sem-confirmar', titulo: 'Seleções sem confirmar', tom: 'critico',
      detalhe: 'Agendadas que já passaram. Lance quem veio.',
      verTudo: linkPara(abaSelecoes),
      itens: p.selecoesSemConfirmar.map(s => ({
        id: s.id, principal: s.cargo, meta: `${sigla(s.sede)} · ${s.convocados} convocados`,
        quando: `dia ${s.data.slice(0, 5)}`, tom: 'critico' as Tom, href: linkDaSelecao(s),
      })),
    },
    {
      id: 'hoje', titulo: 'Seleções de hoje', tom: 'acento',
      detalhe: 'Depois da seleção, lance o resultado de cada candidato.',
      verTudo: linkPara(abaSelecoes),
      itens: p.selecoesHoje.map(s => ({
        id: s.id, principal: s.cargo, meta: [sigla(s.sede), `${s.convocados} convocados`, s.responsavel].filter(Boolean).join(' · '),
        quando: 'hoje', tom: 'acento' as Tom, href: linkDaSelecao(s),
      })),
    },
    {
      id: 'avaliacoes', titulo: 'Avaliações de experiência', tom: p.avaliacoes.some(x => x.dias < 0) ? 'critico' : 'atencao',
      detalhe: 'Marcos de 45 e 90 dias vencidos ou vencendo nesta semana.',
      verTudo: linkPara('experiencias'),
      itens: p.avaliacoes.map(({ e, marco, dias }) => ({
        id: e.id, principal: e.colaborador, meta: [marco, e.funcao, e.sede ? sigla(e.sede) : ''].filter(Boolean).join(' · '),
        quando: quandoVence(dias), tom: (dias < 0 ? 'critico' : dias <= 2 ? 'atencao' : 'neutro') as Tom,
        href: linkPara('experiencias', { pessoa: e.colaborador }),
      })),
    },
    {
      id: 'requisicoes', titulo: 'Requisições para decidir', tom: 'acento',
      detalhe: 'Pedidos de vaga enviados pelos gestores.',
      verTudo: linkPara('requisicoes'),
      itens: p.requisicoes.map(({ r, dias }) => ({
        id: r.id, principal: r.cargo, meta: [sigla(r.sede), r.gestorSolicitante].filter(Boolean).join(' · '),
        quando: dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`, tom: (dias > 7 ? 'atencao' : 'neutro') as Tom,
        href: linkPara('requisicoes'),
      })),
    },
    {
      id: 'vagas', titulo: 'Vagas fora do prazo', tom: 'atencao',
      detalhe: `Mais de ${SLA_META_DIAS} dias na mesma etapa.`,
      verTudo: linkPara('vagas'),
      itens: p.vagasForaDoPrazo.map(({ v, dias }) => ({
        id: v.id, principal: v.vaga, meta: [`nº ${v.codigo}`, sigla(v.sede), v.setor].filter(Boolean).join(' · '),
        quando: `${dias} dias`, tom: (dias > 60 ? 'critico' : 'atencao') as Tom,
        href: linkPara('vagas', { vaga: v.codigo }),
      })),
    },
    {
      id: 'consultas', titulo: 'Consultas no aguardo', tom: 'neutro',
      detalhe: 'Solicitações de funcionários ainda sem atendimento.',
      verTudo: linkPara('consultas'),
      itens: p.consultas.map(c => ({
        id: c.id, principal: c.funcionario, meta: c.especialidade,
        quando: `desde ${c.dataSolicitacao.slice(0, 5)}`, href: linkPara('consultas'),
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
  const numeros: { rotulo: string; valor: string; detalhe?: string; aba: Aba }[] = [
    { rotulo: 'Vagas em aberto', valor: String(vagasAbertas), aba: 'vagas' },
    { rotulo: 'Em período de experiência', valor: String(emExperiencia), aba: 'experiencias' },
    ...(selecoes ? [{
      rotulo: `Seleções em ${mesLongo}`, valor: String(selecoesDoMes.length),
      detalhe: `${selecoesDoMes.reduce((t, s) => t + (s.convocados || 0), 0).toLocaleString('pt-BR')} convocados`, aba: 'selecoesLista' as Aba,
    }] : []),
    { rotulo: 'Participações em treinamentos', valor: treinados.toLocaleString('pt-BR'), aba: 'treinamentos' },
    { rotulo: 'Clima médio nas saídas', valor: clima, detalhe: 'de 5', aba: 'entrevistas' },
  ];

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = (userName || '').trim().split(/\s+/)[0];
  const hojeLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5">
      {mostrarSetembroAmarelo && <SetembroAmarelo />}
      {mostrarOutubroRosa && <OutubroRosa />}

      <header className="pagina-cab">
        <div className="min-w-0">
          <h1 className="pagina-titulo [text-wrap:balance]">
            {saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}.
          </h1>
          <p className="inicio-sub">
            <span className="first-letter:uppercase inline-block">{hojeLabel}</span>
            <span aria-hidden="true"> · </span>
            {frentes.length === 0 ? 'nada pendente por aqui' : `${frentes.length} ${frentes.length === 1 ? 'frente pede' : 'frentes pedem'} atenção`}
          </p>
        </div>
        {podeRegistrarDia && (
          <a href={linkPara('selecoes')} className="btn btn-primario">
            <NotebookPen aria-hidden="true" />
            Registrar meu dia
          </a>
        )}
      </header>

      <ReguaFunil funil={funil} href={linkPara('vagas')} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section aria-labelledby="para-hoje" className="painel lg:col-span-8 min-w-0">
          <header className="inicio-cab">
            <h2 id="para-hoje">Para hoje</h2>
            {frentes.length > 0 && <span>em ordem de urgência</span>}
          </header>

          {frentes.length === 0 ? (
            <div className="px-5 py-10">
              <p className="text-[15px] font-semibold" style={{ color: 'var(--tinta)' }}>Nada pendente para hoje.</p>
              <p className="mt-1 text-[14px] max-w-prose" style={{ color: 'var(--tinta-2)' }}>
                Nenhuma seleção por confirmar, avaliação vencendo ou vaga fora do prazo.
                {podeRegistrarDia && ' Bom momento para registrar o seu dia.'}
              </p>
            </div>
          ) : (
            <ul className="inicio-frentes">
              {frentes.map(f => (
                <li key={f.id} className="inicio-frente">
                  <div className="inicio-frente-cab">
                    <p className="inicio-frente-n" style={{ color: COR[f.tom] }}>{f.itens.length}</p>
                    <div className="min-w-0">
                      <h3>{f.titulo}</h3>
                      <p>{f.detalhe}</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <ul>
                      {f.itens.slice(0, VISIVEIS).map(it => (
                        <li key={it.id}>
                          <a href={it.href} className="inicio-item">
                            <span className="inicio-item-txt">
                              <b>{it.principal}</b>
                              {it.meta && <span>{it.meta}</span>}
                            </span>
                            <span className="inicio-item-quando" style={{ color: COR[it.tom || 'neutro'] }}>{it.quando}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    {f.itens.length > VISIVEIS && (
                      <a href={f.verTudo} className="btn-texto inline-flex items-center gap-1 mt-1">
                        Ver todas as {f.itens.length} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="lg:col-span-4 space-y-5 min-w-0">
          <section aria-labelledby="em-numeros" className="painel">
            <header className="inicio-cab"><h2 id="em-numeros">Em números</h2></header>
            <ul className="inicio-numeros">
              {numeros.map(n => (
                <li key={n.rotulo}>
                  <a href={linkPara(n.aba)}>
                    <span>{n.rotulo}</span>
                    <span className="shrink-0 text-right">
                      <b>{n.valor}</b>
                      {n.detalhe && <small>{n.detalhe}</small>}
                    </span>
                  </a>
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
