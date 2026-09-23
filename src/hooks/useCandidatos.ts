/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Candidatos dos dias de seleção. Só liga para quem a regra deixa ler (RH sem
 * Visualizador): para os demais o listener seria negado e ficaria só erro.
 */
import type { Candidato } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useCandidatos(currentUser: any, enabled = true) {
  // `upsert` com id gerado aqui, e não `create`: o id entra no log na hora de
  // registrar, e o relato conta por candidato (registrar e já lançar o
  // resultado da mesma pessoa é um candidato, não dois).
  const { items, upsert, remove } = useFirestoreCollection<Candidato>({
    collectionName: 'candidatos',
    localKey: 'sgcp_candidatos_fallback',
    newLocalId: () => `local_cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    // Ordem de chegada estável: por nome, senão a lista dança a cada gravação.
    sort: (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
    enabled: enabled && !!currentUser,
  });
  return { candidatos: items, gravarCandidato: upsert, removerCandidato: remove };
}
