/**
 * Sedes de uma turma de treinamento (28/10/2026): uma turma pode reunir gente
 * de várias sedes. `sedes` é a lista; `unidade` continua com a PRIMEIRA, que é
 * o que o código antigo lê (isolamento por unidade, importações) — e toda
 * turma anterior a isto só tem `unidade`.
 */
import type { Treinamento } from '../types';
import type { Sede } from '../hooks/useMetadata';
import { escopoDaSede } from './unidade';

export function sedesDaTurma(t: Pick<Treinamento, 'unidade' | 'sedes'>): string[] {
  if (t.sedes?.length) return t.sedes;
  return t.unidade ? [t.unidade] : [];
}

/** A turma aparece no filtro de qualquer uma das sedes dela. */
export function turmaNaSede(t: Pick<Treinamento, 'unidade' | 'sedes'>, sede: string): boolean {
  const alvo = sede.trim().toLowerCase();
  return sedesDaTurma(t).some(s => s.trim().toLowerCase() === alvo);
}

/**
 * Erro em frase para o RH, ou null. As sedes precisam ser da MESMA unidade:
 * a turma pertence a uma só (Colégio ou Universidade) — é por ela que o banco
 * decide quem lê.
 */
export function erroDasSedes(escolhidas: string[], catalogo: Sede[]): string | null {
  if (!escolhidas.length) return 'Escolha ao menos uma sede.';
  const unidades = new Set(escolhidas.map(s => escopoDaSede(catalogo, s)));
  return unidades.size > 1 ? 'As sedes precisam ser da mesma unidade (todas do Colégio ou todas da Universidade).' : null;
}
