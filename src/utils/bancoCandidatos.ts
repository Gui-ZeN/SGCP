/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Banco de candidatos (16/10/2026): o histórico de cada pessoa nas seleções —
 * quantas vezes foi chamada, como foi cada vez — e o "Nunca mais chamar".
 *
 * O histórico é CALCULADO a partir de `candidatos` (cada documento já é uma
 * convocação), não guardado à parte: nada para ficar desatualizado, e uma
 * pessoa que ganha telefone não exige migração. Só o "Nunca mais chamar" tem
 * coleção própria (`naoChamar`), porque é um fato da pessoa, não da convocação.
 *
 * Quem é a mesma pessoa (decisão do dono):
 *  - com telefone: o telefone. Mesmo nome com telefones diferentes = duas
 *    pessoas — é assim que homônimos se separam daqui para frente;
 *  - sem telefone: o nome normalizado. Entra no grupo de um telefone só se
 *    houver UM grupo de telefone com aquele nome; senão fica no grupo "só
 *    nome", e a tela avisa que pode juntar pessoas diferentes.
 */
import type { Candidato, Selecao } from '../types';
import { normalizarNome } from './catalogo';

/** Só os dígitos, sem o 55 do país nem o 0 antes do DDD; vazio se não parece telefone (10 ou 11 dígitos com DDD). */
export function normalizarTelefone(valor?: string): string {
  let d = String(valor || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 || d.length === 11 ? d : '';
}

/** "(85) 99999-1234" a partir dos dígitos. */
export function formatarTelefone(digitos: string): string {
  const d = normalizarTelefone(digitos);
  if (!d) return digitos;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

// Telefone com DDD (com ou sem +55 e 0), que não está grudado em outro número.
const TELEFONE = /(?<!\d)(\+?55[\s.-]*)?\(?0?\d{2}\)?[\s.-]*9?[\s.-]*\d{4}[\s.-]*\d{4}(?!\d)/g;
const temLetra = (t: string) => /\p{L}/u.test(t);

/**
 * Linha colada "Maria Souza – (85) 99999-1234" → nome e telefone separados.
 * É o único jeito de o telefone entrar sem custar campo a mais: quem convoca
 * 20 nomes já tem os números no WhatsApp, e cola os dois juntos.
 *
 * ⚠️ Na dúvida, NÃO separa (auditoria de 16/10/2026): se depois de tirar o
 * telefone ainda sobra número no nome ("Maria 99999-1234" sem DDD, "Pedro
 * 2025…"), a linha fica inteira como nome — nome com dígito grudado deixava
 * de casar com a mesma pessoa digitada sem telefone, e o histórico se perdia.
 */
export function separarTelefone(linha: string): { nome: string; telefone: string } {
  const texto = String(linha || '');
  const inteiro = texto.replace(/\s+/g, ' ').trim();
  const achados = texto.match(TELEFONE) || [];
  const telefone = achados.map(normalizarTelefone).find(Boolean) || '';
  if (!telefone) return { nome: inteiro, telefone: '' };
  // Só separador SOLTO (entre espaços ou nas pontas) sai: "Ana-Maria" fica.
  // A pontuação que sobra nas pontas ("Maria," "Souza .") também sai —
  // senão "maria," não casava com "maria" e o histórico não ligava.
  const nome = ` ${texto.replace(TELEFONE, ' ')} `.replace(/\s[–—\-|,;:/()]+(?=\s)/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^[\s.,;:–—\-|/()]+|[\s.,;:–—\-|/()]+$/g, '');
  if (/\d/.test(nome)) return { nome: inteiro, telefone: '' };
  return { nome: temLetra(nome) ? nome : '', telefone };
}

/**
 * As linhas da lista de nomes → as convocações a gravar. Linha sem letra
 * nenhuma não vira candidato; linha SÓ com telefone (o WhatsApp cola o nome
 * numa linha e o número na seguinte) vai para o nome de cima, se ele ainda
 * não tiver um.
 */
export function convocacoesDasLinhas(linhas: string[]): { nome: string; telefone: string }[] {
  const saida: { nome: string; telefone: string }[] = [];
  for (const l of linhas) {
    const x = separarTelefone(l);
    if (x.nome && temLetra(x.nome)) { saida.push(x); continue; }
    const anterior = saida[saida.length - 1];
    if (x.telefone && anterior && !anterior.telefone) anterior.telefone = x.telefone;
  }
  return saida;
}

/** DD/MM/AAAA → número que ordena (texto não ordena). */
const ordemDaData = (data?: string) => {
  const m = String(data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
};

export interface Convocacao {
  candidato: Candidato;
  /** Cargo e sede vêm da seleção — o candidato não os guarda. */
  cargo: string;
  sede: string;
}

export interface Pessoa {
  chave: string;
  /** O nome como foi escrito na convocação mais recente. */
  nome: string;
  nomeNorm: string;
  telefone: string;
  /** Mais recente primeiro. */
  convocacoes: Convocacao[];
  vezes: number;
  faltas: number;
  /** Veio (qualquer resultado que não seja Ausente nem "sem resultado"). */
  vieram: number;
  contratada: boolean;
  noBanco: boolean;
  /** Identificada só pelo nome: pode juntar pessoas diferentes. */
  soPeloNome: boolean;
}

export function agruparPessoas(candidatos: Candidato[], selecoes: Selecao[]): Pessoa[] {
  const selecao = new Map(selecoes.map(s => [s.id, s]));
  // 1º: quais telefones existem para cada nome.
  const telefonesDoNome = new Map<string, Set<string>>();
  for (const c of candidatos) {
    const tel = normalizarTelefone(c.telefone);
    if (!tel) continue;
    const n = normalizarNome(c.nome);
    (telefonesDoNome.get(n) || telefonesDoNome.set(n, new Set()).get(n)!).add(tel);
  }
  const grupos = new Map<string, Pessoa>();
  for (const c of candidatos) {
    const nomeNorm = normalizarNome(c.nome);
    if (!nomeNorm) continue;
    let tel = normalizarTelefone(c.telefone);
    if (!tel) {
      const tels = telefonesDoNome.get(nomeNorm);
      if (tels?.size === 1) tel = [...tels][0];
    }
    const chave = tel ? `tel:${tel}` : `nome:${nomeNorm}`;
    const s = selecao.get(c.selecaoId);
    const p = grupos.get(chave) || grupos.set(chave, {
      chave, nome: c.nome, nomeNorm, telefone: tel, convocacoes: [], vezes: 0, faltas: 0, vieram: 0,
      contratada: false, noBanco: false, soPeloNome: !tel,
    }).get(chave)!;
    p.convocacoes.push({ candidato: c, cargo: s?.cargo || '', sede: s?.sede || '' });
  }
  for (const p of grupos.values()) {
    p.convocacoes.sort((a, b) => ordemDaData(b.candidato.data) - ordemDaData(a.candidato.data));
    p.nome = p.convocacoes[0].candidato.nome;
    p.vezes = p.convocacoes.length;
    p.faltas = p.convocacoes.filter(x => x.candidato.resultado === 'ausente').length;
    p.vieram = p.convocacoes.filter(x => !['ausente', 'convocado'].includes(x.candidato.resultado)).length;
    p.contratada = p.convocacoes.some(x => x.candidato.contratado === 'sim');
    p.noBanco = p.convocacoes.some(x => x.candidato.contratado === 'banco');
  }
  return [...grupos.values()];
}

/** Índice para achar a pessoa de um nome digitado (por telefone, se vier). */
export function indicePorPessoa(pessoas: Pessoa[]) {
  const porTel = new Map<string, Pessoa>();
  const porNome = new Map<string, Pessoa[]>();
  for (const p of pessoas) {
    if (p.telefone) porTel.set(p.telefone, p);
    (porNome.get(p.nomeNorm) || porNome.set(p.nomeNorm, []).get(p.nomeNorm)!).push(p);
  }
  return (nome: string, telefone?: string): Pessoa | undefined => {
    const tel = normalizarTelefone(telefone);
    if (tel && porTel.has(tel)) return porTel.get(tel);
    const doNome = porNome.get(normalizarNome(nome)) || [];
    // Telefone novo para um nome que já tem telefone(s): é outra pessoa.
    if (tel) return doNome.find(p => !p.telefone);
    // Mais de uma pessoa com o nome e nenhuma "só nome": não escolhe uma ao
    // acaso (o selo mostraria o histórico de uma e esconderia a outra).
    return doNome.length === 1 ? doNome[0] : doNome.find(p => p.soPeloNome);
  };
}

// ── Nunca mais chamar ──────────────────────────────────────────────────────

/** Motivos curtos: texto livre obrigatório vira "." e "ver com fulana". */
export const MOTIVOS_NAO_CHAMAR = [
  'Faltou repetidas vezes',
  'Comportamento na seleção',
  'Desligado(a) com restrição',
  'Documentação / informação falsa',
  'Outro',
] as const;

export interface MarcaNaoChamar {
  id: string;
  escopo?: 'colegio' | 'universidade';
  nome: string;
  nomeNorm: string;
  telefone?: string;
  motivo: string;
  por: string;
  em?: any;
  desfeito?: { por: string; em?: any; motivo: string };
}

/** A marca ATIVA que vale para este nome/telefone (telefone confirma; nome só sugere). */
export function marcaDe(marcas: MarcaNaoChamar[], nome: string, telefone?: string): { marca: MarcaNaoChamar; peloNome: boolean } | undefined {
  const ativas = marcas.filter(m => !m.desfeito);
  const tel = normalizarTelefone(telefone);
  const porTel = tel ? ativas.find(m => normalizarTelefone(m.telefone) === tel) : undefined;
  if (porTel) return { marca: porTel, peloNome: false };
  const n = normalizarNome(nome);
  const porNome = ativas.find(m => m.nomeNorm === n);
  // Marca com telefone e convocação com OUTRO telefone: outra pessoa.
  if (porNome && tel && porNome.telefone && normalizarTelefone(porNome.telefone) !== tel) return undefined;
  return porNome ? { marca: porNome, peloNome: !tel || !porNome.telefone } : undefined;
}

export interface Aviso {
  /** Convocações anteriores (sem contar a da própria linha). */
  vezes: number;
  /** A última vaga: cargo e data (DD/MM/AA). */
  ultima?: { cargo: string; data: string };
  /** Motivo do "Não chamar", quando a pessoa está marcada. */
  naoChamar?: string;
}

/**
 * O selo ao lado de um nome: quantas vezes já foi chamado, a última vaga e o
 * "Não chamar". Só isso — pedido do Guilherme (16/10/2026), depois de ver a
 * 1ª versão com "mesmo nome · faltou 2x · …": texto demais para ler a cada
 * nome. O resto (faltas, homônimos, resultado de cada vez) está na ficha.
 * `excluir`: a convocação que está na tela não conta como histórico.
 */
export function avisoDe(pessoa: Pessoa | undefined, marca: ReturnType<typeof marcaDe>, excluir?: string): Aviso | null {
  const outras = pessoa ? pessoa.convocacoes.filter(x => x.candidato.id !== excluir) : [];
  if (!outras.length && !marca) return null;
  const ult = outras[0];
  return {
    vezes: outras.length,
    ...(ult ? { ultima: { cargo: ult.cargo, data: `${ult.candidato.data.slice(0, 6)}${ult.candidato.data.slice(8)}` } } : {}),
    ...(marca ? { naoChamar: marca.marca.motivo } : {}),
  };
}

/**
 * Sugestões enquanto o RH digita um nome (pedido do Guilherme, 16/10/2026):
 * a partir de 3 letras, as pessoas do banco cujo nome contém cada palavra
 * digitada. Quem começa pelo que foi digitado vem primeiro; depois, quem foi
 * mais convocado. A pessoa já escolhida (mesmo nome e mesmo telefone) some da
 * lista — senão ela reaparecia logo depois de escolhida.
 */
export function sugestoesDeNome(pessoas: Pessoa[], texto: string, max = 6): Pessoa[] {
  const { nome, telefone } = separarTelefone(texto);
  const q = normalizarNome(nome);
  if (q.length < 3) return [];
  const palavras = q.split(' ');
  return pessoas
    .filter(p => palavras.every(w => p.nomeNorm.includes(w)))
    .filter(p => !(p.nomeNorm === q && (p.telefone || '') === telefone))
    .sort((a, b) => Number(b.nomeNorm.startsWith(q)) - Number(a.nomeNorm.startsWith(q)) || b.vezes - a.vezes || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, max);
}

/** O que vai para o campo ao escolher a sugestão: o nome, e o telefone se houver (identifica a pessoa). */
export const linhaDaPessoa = (p: Pessoa) => (p.telefone ? `${p.nome} – ${formatarTelefone(p.telefone)}` : p.nome);
