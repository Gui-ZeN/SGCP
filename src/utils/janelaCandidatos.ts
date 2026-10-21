/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Leitura dos candidatos por partes (19/10/2026). A coleção passou de 12 mil
 * documentos e era escutada INTEIRA: cada aba que voltava depois de 30 min
 * parada relia tudo — 10 mil leituras de uma vez, 98% das leituras do banco.
 * Agora a escuta ao vivo traz só os últimos 60 dias; o resto vem quando a
 * tela pede (a seleção aberta, o ano escolhido, o nome digitado).
 *
 * Para isso cada candidato guarda dois campos de busca, derivados ao gravar:
 *  - `dataISO` (AAAA-MM-DD): `data` é DD/MM/AAAA, que não ordena como texto;
 *  - `nomeNorm`: o nome sem acento e minúsculo — o Banco acha a pessoa por ele.
 */
import type { Candidato } from '../types';
import { normalizarNome } from './catalogo';

export const DIAS_AO_VIVO = 60;

/** DD/MM/AAAA → AAAA-MM-DD; vazio se não for uma data assim. */
export function dataISODe(data?: string): string {
  const m = String(data || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** O primeiro dia da janela ao vivo (AAAA-MM-DD, pelo relógio local). */
export function corteDaJanela(hoje: Date = new Date(), dias = DIAS_AO_VIVO): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Os campos de busca que acompanham uma gravação: só os do que está sendo
 * gravado (o upsert é merge — gravar só o resultado não mexe no nome).
 */
export function camposDeBusca(campos: Partial<Candidato>): { dataISO?: string; nomeNorm?: string } {
  const saida: { dataISO?: string; nomeNorm?: string } = {};
  if (typeof campos.data === 'string') saida.dataISO = dataISODe(campos.data);
  if (typeof campos.nome === 'string') saida.nomeNorm = normalizarNome(campos.nome);
  return saida;
}

/**
 * As seleções cujos candidatos ainda não estão na tela: as de antes da janela
 * (ou de data que não se lê) que ninguém pediu ainda.
 */
export function selecoesQueFaltam(selecoes: { id: string; data?: string }[], pedidas: Set<string>, corte: string): string[] {
  const ids = new Set<string>();
  for (const s of selecoes) {
    if (!s?.id || pedidas.has(s.id)) continue;
    const iso = dataISODe(s.data);
    if (!iso || iso < corte) ids.add(s.id);
  }
  return [...ids];
}

/** A faixa [de, ate) de `dataISO` que falta para ter o ano (null = já cabe na janela). */
export function faixaDoAno(ano: number, corte: string): { de: string; ate: string } | null {
  const de = `${ano}-01-01`;
  const fimDoAno = `${ano + 1}-01-01`;
  const ate = fimDoAno < corte ? fimDoAno : corte;
  return de < ate ? { de, ate } : null;
}

/** Quebra uma lista em pedaços (o `in` do Firestore aceita até 30 valores). */
export function emLotes<T>(lista: T[], tamanho = 30): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho));
  return saida;
}

/**
 * Um prefixo já buscado cobre o mais longo quando a busca veio COMPLETA
 * (não bateu no limite): "mar" trouxe 12 de no máximo 50 → "maria" está
 * toda ali e não precisa ir ao banco de novo.
 */
export function prefixoCoberto(q: string, completos: Iterable<string>): boolean {
  for (const p of completos) if (q.startsWith(p)) return true;
  return false;
}

export const porNome = (a: Candidato, b: Candidato) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR');

/**
 * A janela ao vivo + o que veio por pedido. Ao vivo por cima: é o mais novo.
 * `corte` (só quando a escuta está de pé): da janela em diante vale SÓ a
 * escuta — o que outra pessoa apagou ali não fica preso numa cópia lida antes.
 * Escuta caída: vale a cópia (é melhor que a lista vazia).
 */
export function mesclar(janela: Candidato[], extras: Map<string, Candidato>, corte?: string): Candidato[] {
  if (!extras.size) return janela;
  const ids = new Set(janela.map(c => c.id));
  const resto = [...extras.values()].filter(c => !ids.has(c.id) && !(corte && c.dataISO && c.dataISO >= corte));
  return resto.length ? [...janela, ...resto].sort(porNome) : janela;
}
