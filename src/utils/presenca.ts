/**
 * Presença em turma de treinamento (28/10/2026): quem da Infra participou.
 *
 * A lista vem do quadro do Chromos (só ASG ativos) e o RH pode lançar à mão
 * quem participou e não está lá — o quadro às vezes está atrasado. A pessoa
 * lançada à mão leva `foraDoQuadro`, para ficar visível que o Chromos precisa
 * de atualização.
 *
 * ⚠️ As Rules não percorrem lista (só limitam o tamanho e a unidade): o
 * formato de cada participante é garantido AQUI, antes de gravar.
 */
import type { Participante } from '../types';
import { normalizarNome } from './catalogo';

export const MAX_PARTICIPANTES = 300; // o mesmo teto das Rules
const MAX_NOME = 120;
const CONTROLE = /[\u0000-\u001F\u007F]/;

/** Mesma pessoa: pela matrícula quando os dois têm; senão pelo nome normalizado. */
export function mesmoParticipante(a: Pick<Participante, 'matricula' | 'nome'>, b: Pick<Participante, 'matricula' | 'nome'>): boolean {
  if (a.matricula && b.matricula) return a.matricula === b.matricula;
  return normalizarNome(a.nome) === normalizarNome(b.nome);
}

/**
 * Valida a pessoa lançada à mão. Devolve o participante pronto ou o erro em
 * frase para o RH. `sedes`: os códigos que a tela conhece (sede fora deles
 * vira vazia).
 */
export function participanteManual(
  entrada: { nome: string; matricula: string; sede: string },
  lista: Participante[],
  sedes: string[],
): { participante: Participante } | { erro: string } {
  const nome = entrada.nome.trim().replace(/\s+/g, ' ');
  if (!nome) return { erro: 'Escreva o nome de quem participou.' };
  if (nome.length > MAX_NOME) return { erro: `O nome passa de ${MAX_NOME} letras.` };
  if (CONTROLE.test(entrada.nome)) return { erro: 'O nome tem um caractere inválido.' };
  const matricula = entrada.matricula.trim();
  if (matricula && !/^\d{1,12}$/.test(matricula)) return { erro: 'A matrícula tem só números (até 12).' };
  if (lista.length >= MAX_PARTICIPANTES) return { erro: `A turma já tem ${MAX_PARTICIPANTES} participantes, o máximo.` };
  const novo: Participante = { matricula, nome, sede: sedes.includes(entrada.sede) ? entrada.sede : '', foraDoQuadro: true };
  const repetido = lista.find(p => mesmoParticipante(p, novo));
  if (repetido) return { erro: `${repetido.nome} já está na lista.` };
  return { participante: novo };
}

/** Do quadro: só os três campos, nunca `foraDoQuadro` — o resto do Chromos não é gravado. */
export function participanteDoQuadro(p: { matricula: string; nome: string; sede: string }): Participante {
  return { matricula: p.matricula, nome: p.nome, sede: p.sede };
}

/** Marca ou desmarca alguém do quadro. Não duplica, nem com a mesma pessoa lançada à mão. */
export function alternar(lista: Participante[], p: Participante): Participante[] {
  return lista.some(x => mesmoParticipante(x, p))
    ? lista.filter(x => !mesmoParticipante(x, p))
    : lista.length >= MAX_PARTICIPANTES ? lista : [...lista, p];
}
