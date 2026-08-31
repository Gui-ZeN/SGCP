/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consultas solicitadas pelos funcionários do Colégio.
 *
 * Usa o `useFirestoreCollection` (o mesmo caminho de dados dos módulos
 * operacionais: onSnapshot em tempo real + fallback localStorage), em vez de
 * abrir mais um caminho próprio.
 */

import { Consulta } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

const LOCAL_KEY = 'sgcp_consultas_fallback';

/** DD/MM/YYYY → AAAAMMDD, para ordenar por data como texto. */
const chaveData = (data?: string) => (data || '').split('/').reverse().join('');

export function useConsultas(currentUser: any, enabled: boolean = true) {
  const col = useFirestoreCollection<Consulta>({
    collectionName: 'consultas',
    localKey: LOCAL_KEY,
    // Sem seed: fila de solicitações reais não se inventa no modo demo.
    seed: [],
    sort: (a, b) => chaveData(b.dataSolicitacao).localeCompare(chaveData(a.dataSolicitacao)),
    newLocalId: () => `local_cons_${Date.now()}`,
    enabled: enabled && !!currentUser
  });

  return {
    consultas: col.items,
    loading: col.loading,
    usingFirebase: col.usingFirebase,
    addConsulta: col.create,
    updateConsulta: col.update,
    deleteConsulta: col.remove
  };
}
