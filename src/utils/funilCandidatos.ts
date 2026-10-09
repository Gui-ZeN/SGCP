/**
 * O funil de candidatos conduzido pelo Kanban da vaga (08/10/2026).
 *
 * Os candidatos continuam sendo da SELEÇÃO (um dia de seleção pode atender
 * várias vagas do mesmo cargo). Cada pessoa avança assim:
 *   convocada → veio (resultado ≠ convocado/ausente) → etapa 'testes'
 *   → etapa 'documentacao' + vagaId (a vaga para a qual ela segue).
 * Quem decide cada passo é o RH, no modal de cada passagem do Kanban; aqui só
 * as regras de quem aparece em cada lista.
 */
import type { Candidato, Selecao } from '../types';
import { selecoesDaVaga } from './selecao';

export interface CandidatoNaVaga extends Candidato {
  selecao: Selecao;
}

/** Os candidatos das seleções ligadas à vaga, cada um com a sua seleção. */
export function candidatosDaVaga(
  vaga: { id: string; codigo?: number | string },
  selecoes: Selecao[],
  candidatos: Candidato[],
): CandidatoNaVaga[] {
  const ligadas = selecoesDaVaga(selecoes, vaga);
  const porId = new Map(ligadas.map(s => [s.id, s]));
  return candidatos
    .filter(c => porId.has(c.selecaoId))
    .map(c => ({ ...c, selecao: porId.get(c.selecaoId)! }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Veio à seleção: tem resultado e não é ausente. */
export const veio = (c: Pick<Candidato, 'resultado'>) => c.resultado !== 'convocado' && c.resultado !== 'ausente';

/** Resultados que encerram a pessoa no processo. */
const PARA = new Set(['ausente', 'desistiu', 'r_restricao', 'risco', 'fora_perfil']);
export const saiuDoProcesso = (c: Pick<Candidato, 'resultado'>) => PARA.has(c.resultado);

export function presenca(lista: Pick<Candidato, 'resultado'>[]) {
  const ausentes = lista.filter(c => c.resultado === 'ausente').length;
  const semResultado = lista.filter(c => c.resultado === 'convocado').length;
  return { convocados: lista.length, compareceram: lista.length - ausentes - semResultado, ausentes, semResultado };
}

/** Já seguiu para a documentação de OUTRA vaga: não entra mais nas listas desta. */
const deOutraVaga = (c: Pick<Candidato, 'etapa' | 'vagaId'>, vagaId: string) =>
  c.etapa === 'documentacao' && !!c.vagaId && c.vagaId !== vagaId;

/** Entrevista → Testes: todo mundo da seleção, menos quem já foi para outra vaga. */
export function listaParaTestes(lista: CandidatoNaVaga[], vagaId: string): CandidatoNaVaga[] {
  return lista.filter(c => !deOutraVaga(c, vagaId));
}

/**
 * → Documentação: quem está em testes (ou já está na documentação desta vaga).
 * Pulando os testes (de Entrevista direto), entra quem veio e não saiu do processo.
 */
export function listaParaDocumentacao(lista: CandidatoNaVaga[], vagaId: string, pulandoTestes: boolean): CandidatoNaVaga[] {
  return lista.filter(c => {
    if (deOutraVaga(c, vagaId)) return false;
    if (c.etapa === 'testes' || (c.etapa === 'documentacao' && c.vagaId === vagaId)) return true;
    return pulandoTestes && veio(c) && !saiuDoProcesso(c);
  });
}

/** Quem está na documentação desta vaga — o nome que o "Concluir" já sugere. */
export function naDocumentacao(lista: CandidatoNaVaga[], vagaId: string): CandidatoNaVaga[] {
  return lista.filter(c => c.etapa === 'documentacao' && c.vagaId === vagaId);
}
