/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regras do ciclo de vida de um dia de seleção: agendar antes, confirmar depois.
 */

import type { Selecao } from '../types';
import type { Sede } from '../hooks/useMetadata';
import { siglaDaSede, chaveDeSede } from './filtroIndicadores';
import { normalizarNome } from './catalogo';

/**
 * O evento já aconteceu?
 *
 * Registro SEM status conta como realizado — são os 220 importados da planilha,
 * que já tinham acontecido. Tratar ausência como "agendado" apagaria o
 * histórico inteiro do funil.
 */
export function ehRealizada(s: Pick<Selecao, 'status'>): boolean {
  return (s.status || 'realizado') === 'realizado';
}

/** Agendamento cuja data já passou e ninguém confirmou — vira cobrança na agenda. */
export function estaAtrasada(s: Pick<Selecao, 'status' | 'data'>, hojeBR: string): boolean {
  if (ehRealizada(s)) return false;
  const chave = (br: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((br || '').trim());
    return m ? Number(m[3] + m[2] + m[1]) : null;
  };
  const dia = chave(s.data);
  const hoje = chave(hojeBR);
  return dia !== null && hoje !== null && dia < hoje;
}

/** Erros do agendamento, em pt-BR. Lista vazia = pode gravar. */
export function validarAgendamento(dados: {
  data?: string; cargo?: string; sede?: string; convocados?: number;
}): string[] {
  const erros: string[] = [];
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test((dados.data || '').trim())) erros.push('Escolha a data da seleção.');
  if (!(dados.cargo || '').trim()) erros.push('Informe o cargo.');
  if (!(dados.sede || '').trim()) erros.push('Informe a sede.');
  if (!dados.convocados || dados.convocados < 1) erros.push('Informe quantas pessoas foram convocadas.');
  return erros;
}

/**
 * Erros da confirmação de presença.
 *
 * Compareceram acima de convocados é erro de digitação, não dado: apareceria
 * como taxa acima de 100% no indicador.
 */
export function validarConfirmacao(convocados: number, compareceram: number): string[] {
  const erros: string[] = [];
  if (compareceram < 0) erros.push('O número de presentes não pode ser negativo.');
  if (compareceram > convocados) {
    erros.push(`Compareceram (${compareceram}) não pode ser maior que convocados (${convocados}).`);
  }
  return erros;
}

/**
 * Códigos das vagas ligadas à seleção, em um formato só.
 *
 * Lê a LISTA (formato atual) e cai no campo único dos registros gravados antes
 * dela. Sem isto, toda tela que mostra o vínculo precisaria conhecer os dois
 * formatos — e os agendamentos de setembro apareceriam sem vaga nenhuma.
 */
export function codigosDasVagas(s: Pick<Selecao, 'vagaCodigos' | 'vagaCodigo'>): number[] {
  if (s.vagaCodigos?.length) return s.vagaCodigos;
  return s.vagaCodigo === undefined || s.vagaCodigo === null ? [] : [s.vagaCodigo];
}

export interface FunilDaVaga {
  /** Seleções realizadas ligadas a esta vaga. */
  selecoes: number;
  chamados: number;
  compareceram: number;
  aprovados: number;
  /** Data da última seleção realizada, DD/MM/AAAA. */
  ultimaData: string;
}

/**
 * Soma o que as seleções desta vaga já registraram.
 *
 * Serve para PRÉ-PREENCHER o funil quando o RH move a vaga de etapa: os
 * números de chamou/veio/aprovou já foram digitados uma vez na seleção, e
 * pedi-los de novo é o tipo de digitação dupla que o sistema existe para
 * evitar. Nada aqui grava sozinho — quem decide é quem move a vaga.
 *
 * Só conta seleção REALIZADA: um agendamento futuro tem `compareceram: 0` e
 * entraria como "ninguém veio".
 */
export function funilDaVaga(
  selecoes: Selecao[],
  vaga: { id: string; codigo?: number | string }
): FunilDaVaga {
  const codigo = vaga.codigo === undefined || vaga.codigo === null ? null : Number(vaga.codigo);
  const ligadas = selecoes.filter(s => {
    if (!ehRealizada(s)) return false;
    if (s.vagaIds?.includes(vaga.id) || s.vagaId === vaga.id) return true;
    return codigo !== null && codigosDasVagas(s).includes(codigo);
  });

  return {
    selecoes: ligadas.length,
    chamados: ligadas.reduce((t, s) => t + (s.convocados || 0), 0),
    compareceram: ligadas.reduce((t, s) => t + (s.compareceram || 0), 0),
    aprovados: ligadas.reduce((t, s) => t + (s.contratados || 0), 0),
    ultimaData: ligadas
      .map(s => s.data)
      .sort((a, b) => (a || '').split('/').reverse().join('').localeCompare((b || '').split('/').reverse().join('')))
      .at(-1) || '',
  };
}

export interface TotaisDeSelecao {
  convocados: number;
  compareceram: number;
  ausentes: number;
  desistiram: number;
  contratados: number;
  /** Quantos dias ainda esperam confirmação de presença. */
  aConfirmar: number;
  /** % de comparecimento, ou null quando não há dia realizado para medir. */
  taxa: number | null;
}

/**
 * Soma os dias de seleção — a linha "TOTAL" que as abas QUANTI trazem no topo.
 *
 * Agendado NÃO entra no numerador nem no denominador da taxa: um dia que ainda
 * não chegou tem `compareceram: 0`, e somá-lo derrubaria o comparecimento por
 * um evento que nem aconteceu. Ele aparece só em `aConfirmar`.
 */
export function totaisDeSelecoes(selecoes: Selecao[]): TotaisDeSelecao {
  const realizadas = selecoes.filter(ehRealizada);
  const soma = (campo: keyof Pick<Selecao, 'convocados' | 'compareceram' | 'ausentes' | 'desistiram' | 'contratados'>) =>
    realizadas.reduce((t, s) => t + (s[campo] || 0), 0);

  const convocados = soma('convocados');
  const compareceram = soma('compareceram');

  return {
    convocados,
    compareceram,
    ausentes: soma('ausentes'),
    desistiram: soma('desistiram'),
    contratados: soma('contratados'),
    aConfirmar: selecoes.length - realizadas.length,
    taxa: convocados === 0 ? null : Math.round((compareceram / convocados) * 1000) / 10,
  };
}

/** Campos gravados ao confirmar: ausentes saem da conta, não da digitação. */
export function camposDaConfirmacao(convocados: number, compareceram: number): Pick<Selecao, 'status' | 'compareceram' | 'ausentes'> {
  return {
    status: 'realizado',
    compareceram,
    ausentes: Math.max(0, convocados - compareceram),
  };
}

/** O formulário do módulo Seleções — o dia de seleção como uma linha da QUANTI. */
export interface FormularioSelecao {
  data: string; // DD/MM/AAAA
  cargo: string;
  sede: string;
  origem: Selecao['origem'];
  setor: string;
  gestor: string;
  responsavel: string;
  convocados: number;
  /** Já aconteceu? Então os números abaixo valem e ela nasce "realizada". */
  jaAconteceu: boolean;
  compareceram: number;
  ausentes: number;
  desistiram: number;
  contratados: number;
  /** Vagas do Quadro que esta seleção atende (opcional: professor quase nunca tem vaga). */
  vagaIds?: string[];
}

/**
 * Valida e monta os campos da seleção. Lançar DEPOIS do fato é o jeito que o
 * RH trabalha na planilha — por isso "já aconteceu" existe no formulário, e
 * não só o agendamento seguido de confirmação.
 *
 * Não exige convocados = compareceram + ausentes: a planilha não fecha essa
 * conta em 54 dos 263 dias de 2026, e travar aqui faria o RH desistir do
 * sistema. Exige só o impossível: mais gente do que foi chamada.
 */
export function camposDoFormulario(f: FormularioSelecao): { erros: string[]; campos: Omit<Selecao, 'id'> } {
  const erros = validarAgendamento({ data: f.data, cargo: f.cargo, sede: f.sede, convocados: f.convocados });
  const n = (x: number) => Math.max(0, Math.floor(Number(x)) || 0);
  const [comp, aus, des, cont] = f.jaAconteceu ? [n(f.compareceram), n(f.ausentes), n(f.desistiram), n(f.contratados)] : [0, 0, 0, 0];
  if (f.jaAconteceu) {
    if (comp + aus > f.convocados) erros.push(`Compareceram + ausentes (${comp + aus}) passa dos convocados (${f.convocados}).`);
    if (cont > comp) erros.push(`Contratados (${cont}) não pode passar de quem compareceu (${comp}).`);
  }
  return {
    erros,
    campos: {
      data: f.data.trim(), cargo: f.cargo.trim(), sede: f.sede.trim(), origem: f.origem,
      setor: f.setor.trim(), gestor: f.gestor.trim(), responsavel: f.responsavel.trim(),
      convocados: n(f.convocados), compareceram: comp, ausentes: aus, desistiram: des, contratados: cont,
      status: f.jaAconteceu ? 'realizado' : 'agendado',
      vagaIds: f.vagaIds || [],
    },
  };
}

// ─── seleção ↔ vaga ─────────────────────────────────────────────────────────

/** A seleção atende esta vaga? (lista atual, campo único antigo ou código) */
export function atendeVaga(s: Selecao, vaga: { id: string; codigo?: number | string }): boolean {
  if (s.vagaIds?.includes(vaga.id) || s.vagaId === vaga.id) return true;
  const codigo = vaga.codigo === undefined || vaga.codigo === null ? null : Number(vaga.codigo);
  return codigo !== null && codigosDasVagas(s).includes(codigo);
}

/** As seleções ligadas à vaga, da mais recente para a mais antiga (agendadas incluídas). */
export function selecoesDaVaga(selecoes: Selecao[], vaga: { id: string; codigo?: number | string }): Selecao[] {
  const chave = (d: string) => (d || '').split('/').reverse().join('');
  return selecoes.filter(s => atendeVaga(s, vaga)).sort((a, b) => chave(b.data).localeCompare(chave(a.data)));
}

export interface FunilEfetivo {
  chamados: number;
  compareceram: number;
  aprovados: number;
  /** 'selecao' = somado das seleções ligadas (decisão de 23/09/2026: automático); 'manual' = digitado na vaga. */
  fonte: 'selecao' | 'manual';
  selecoes: number;
}

/**
 * O funil que a vaga MOSTRA. Vaga com seleção ligada: a soma das seleções,
 * sempre atualizada, sem ninguém digitar (decisão de 23/09/2026 — antes era só
 * sugestão ao mover de etapa). Sem seleção ligada: o que foi digitado na vaga.
 */
export function funilEfetivo(
  vaga: { id: string; codigo?: number | string; candChamados?: number; candCompareceram?: number; candAprovados?: number },
  selecoes: Selecao[]
): FunilEfetivo {
  const f = funilDaVaga(selecoes, vaga);
  if (selecoes.some(s => atendeVaga(s, vaga))) {
    return { chamados: f.chamados, compareceram: f.compareceram, aprovados: f.aprovados, fonte: 'selecao', selecoes: f.selecoes };
  }
  return { chamados: vaga.candChamados || 0, compareceram: vaga.candCompareceram || 0, aprovados: vaga.candAprovados || 0, fonte: 'manual', selecoes: 0 };
}

const EM_ANDAMENTO = ['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO'];

/**
 * As vagas que uma seleção pode atender: abertas, da MESMA sede (pela sigla do
 * cadastro — "DT" e "DIONISIO TORRES" são a mesma), com as do mesmo cargo
 * primeiro. As já ligadas entram mesmo se fecharam depois, para não sumirem da
 * lista de quem está corrigindo.
 */
export function vagasSugeridas<V extends { id: string; vaga: string; sede: string; status: string; codigo?: number | string }>(
  vagas: V[], sedes: Sede[], sede: string, cargo: string, jaLigadas: string[] = []
): V[] {
  const alvo = chaveDeSede(siglaDaSede(sedes, sede));
  const c = normalizarNome(cargo);
  return vagas
    .filter(v => jaLigadas.includes(v.id) || (EM_ANDAMENTO.includes((v.status || '').toUpperCase()) && !!alvo && chaveDeSede(siglaDaSede(sedes, v.sede)) === alvo))
    .sort((a, b) => Number(normalizarNome(b.vaga) === c) - Number(normalizarNome(a.vaga) === c) || a.vaga.localeCompare(b.vaga, 'pt-BR'));
}
