/**
 * O que falta lançar para o relatório do mês bater (30/10/2026), item a item e
 * com o link para o lugar exato — antes eram só contagens ("17 desistentes sem
 * motivo"), e o RH caçava quais eram (revisão de operação, 30/10/2026).
 * Vai para a tela, nunca para o PDF. Puro, para ser testado.
 *
 * Não mostra nome de candidato: a pendência de motivo aponta o dia e o cargo
 * da seleção; o nome fica na tela da seleção.
 */
import type { Vaga, Selecao, Experiencia, Integracao, Treinamento } from '../types';
import { linkPara } from '../lib/rotas';
import { anoMes } from './filtroIndicadores';
import { ehRealizada } from './selecao';
import { toISOInput } from './date';
import { doMes, avaliacaoDoMes } from './relatorioMensal';

export interface ItemPendente { id: string; principal: string; detalhe: string; link: string }
export interface Pendencia {
  id: 'agendadas' | 'semMotivo' | 'semLista' | 'experiencia' | 'integracao' | 'semConclusao' | 'semTempo' | 'semPresenca';
  titulo: string;
  /** Por que importa para o relatório. */
  efeito: string;
  itens: ItemPendente[];
  /** Resolver a categoria de uma vez, quando a tela de destino filtra (Integração). */
  todos?: string;
}

/** Desistentes da seleção que não têm motivo lançado. */
export const desistentesSemMotivo = (s: Pick<Selecao, 'desistiram' | 'motivos'>) =>
  Math.max(0, (Number(s.desistiram) || 0) - Object.values(s.motivos || {}).reduce((t, n) => t + (Number(n) || 0), 0));

/**
 * Onde a seleção se resolve, pela UNIDADE dela — não pelo perfil de quem
 * olha: o Administrador vê as duas, e a da Universidade abria no Resumo do Dia
 * do Colégio (auditoria, 30/10/2026).
 */
export const abaDaUnidade = (unidade?: string): 'selecoes' | 'selecoesLista' => (unidade === 'universidade' ? 'selecoesLista' : 'selecoes');

/** A seleção abre no dia dela (Resumo do Dia, Colégio) ou nela mesma (Seleções, Universidade) — como no Início. */
export const linkDaSelecao = (s: Selecao, aba: 'selecoes' | 'selecoesLista') =>
  aba === 'selecoes' ? linkPara('selecoes', { dia: toISOInput(s.data) }) : linkPara('selecoesLista', { selecao: s.id });

const dataCurta = (d?: string) => (d || '').slice(0, 5);
/** "nº 124", ou nada quando a vaga não tem número (o link cai na lista: `linkPara` ignora o vazio). */
const nº = (v: Pick<Vaga, 'codigo'>) => (v.codigo ? `nº ${v.codigo}` : '');

export function pendenciasDoMes(e: {
  ano: number; mes: number; hojeISO: string;
  vagas: Vaga[]; selecoes: Selecao[]; experiencias: Experiencia[]; integracoes: Integracao[]; treinamentos: Treinamento[];
  comIntegracao: boolean;
  abaSelecoes: 'selecoes' | 'selecoesLista';
}): Pendencia[] {
  const noMes = doMes(e.ano, e.mes);
  const sel = e.selecoes.filter(s => noMes(s.data));
  const p: Pendencia[] = [];
  const add = (x: Pendencia) => { if (x.itens.length) p.push(x); };
  const itemSel = (s: Selecao, detalhe: string): ItemPendente => ({ id: s.id, principal: s.cargo, detalhe: `${dataCurta(s.data)} · ${s.sede}${detalhe ? ` · ${detalhe}` : ''}`, link: linkDaSelecao(s, e.abaSelecoes) });

  add({ id: 'agendadas', titulo: 'Seleções sem confirmar quem compareceu', efeito: 'ficam fora de todos os números de seleção',
    itens: sel.filter(s => !ehRealizada(s)).map(s => itemSel(s, `${s.convocados} convocados`)) });

  // Com a lista de nomes, o motivo é lançado em cada candidato. Sem ela (números
  // digitados à mão), não há onde lançar — é outra pendência, para não prometer
  // o que a tela não resolve.
  const comDesistente = sel.filter(s => ehRealizada(s) && desistentesSemMotivo(s) > 0);
  add({ id: 'semMotivo', titulo: 'Desistentes sem motivo', efeito: 'a página de motivos sai incompleta',
    itens: comDesistente.filter(s => s.numerosPelaLista).map(s => itemSel(s, `${desistentesSemMotivo(s)} sem motivo`)) });
  add({ id: 'semLista', titulo: 'Desistentes em seleção sem lista de nomes', efeito: 'o motivo só entra lançando os nomes do dia',
    itens: comDesistente.filter(s => !s.numerosPelaLista).map(s => itemSel(s, `${desistentesSemMotivo(s)} desistente(s)`)) });

  add({ id: 'experiencia', titulo: 'Avaliações de experiência vencidas sem desfecho', efeito: 'a participação da sede cai',
    itens: e.experiencias.flatMap(x => {
      const a = avaliacaoDoMes(x, e.ano, e.mes, e.hojeISO);
      return a?.desfecho === 'semDesfecho'
        ? [{ id: x.id, principal: x.colaborador, detalhe: `${a.marco} · venceu ${dataCurta(a.vence)}${x.sede ? ` · ${x.sede}` : ''}`, link: linkPara('experiencias', { pessoa: x.colaborador }) }]
        : [];
    }) });

  if (e.comIntegracao) {
    const mesISO = `${e.ano}-${String(e.mes).padStart(2, '0')}`;
    add({ id: 'integracao', titulo: 'Integrações como "Não realizado"', efeito: 'o percentual de integração da sede cai',
      todos: linkPara('integracao', { situacao: 'Não realizado', admissao: mesISO }),
      itens: e.integracoes.filter(i => noMes(i.admissao) && i.status === 'Não realizado').map(i => ({
        id: i.id, principal: i.nome, detalhe: `admissão ${dataCurta(i.admissao)} · ${i.sede}`,
        link: linkPara('integracao', { situacao: 'Não realizado', admissao: mesISO }),
      })) });
  }

  // Concluída sem data some de TODO mês sem aviso — explica parte do "sistema
  // 14 × deck 19" de setembro. Olha as solicitadas no ano do relatório.
  const vagas = e.vagas.filter(v => v.status === 'FECHADA');
  add({ id: 'semConclusao', titulo: 'Vagas concluídas sem data de conclusão', efeito: 'não entram em nenhum mês como fechadas',
    itens: vagas.filter(v => !anoMes(v.conclusao) && anoMes(v.solicitacao)?.[0] === e.ano).map(v => ({
      id: v.id, principal: v.vaga, detalhe: [nº(v), v.sede].filter(Boolean).join(' · '), link: linkPara('vagas', { vaga: v.codigo }),
    })) });
  add({ id: 'semTempo', titulo: 'Vagas concluídas no mês sem tempo de processo', efeito: 'ficam fora da média de dias para fechar',
    itens: vagas.filter(v => noMes(v.conclusao) && !((v.tempoProcesso || 0) > 0)).map(v => ({
      id: v.id, principal: v.vaga, detalhe: [nº(v), `concluída ${dataCurta(v.conclusao)}`].filter(Boolean).join(' · '), link: linkPara('vagas', { vaga: v.codigo }),
    })) });

  add({ id: 'semPresenca', titulo: 'Treinamentos do mês sem presentes lançados', efeito: 'saem com 0 participantes',
    itens: e.treinamentos.filter(t => noMes(t.dataInicio) && !(Number(t.qtdRealizada) > 0) && isoDeBR(t.dataInicio) <= e.hojeISO).map(t => ({
      id: t.id, principal: t.tema, detalhe: `${dataCurta(t.dataInicio)} · ${t.unidade}`, link: linkPara('treinamentos'),
    })) });

  return p;
}

const isoDeBR = (d?: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d || '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : (d || '').slice(0, 10); };
