/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * As linhas do log de auditoria de QUEM ESTÁ LOGADO — e só delas.
 *
 * O "Meu dia" mostra à pessoa o que o sistema já registrou dela ("do
 * sistema", travado) antes de ela completar o relatório. O log inteiro só
 * Administrador e Coordenador leem; para os demais a regra do banco libera as
 * linhas em que `usuario` é o próprio e-mail, e esta consulta pede exatamente
 * isso. Consulta sem o filtro seria negada — é o teste
 * "consulta sem filtro continua negada para analista".
 */
import { useEffect, useState } from 'react';
import { db, isFirebaseEnabled, collection, onSnapshot, query, where } from '../lib/firebase';
import type { EntradaLog } from '../utils/resumoDia';

export function useMeuLog(currentUser: any) {
  const [linhas, setLinhas] = useState<EntradaLog[]>([]);
  const email = String(currentUser?.email || '').trim();

  useEffect(() => {
    if (!isFirebaseEnabled || !db || !email) { setLinhas([]); return; }
    const unsub = onSnapshot(
      query(collection(db, 'logs'), where('usuario', '==', email)),
      (snap: any) => {
        const lista: EntradaLog[] = [];
        snap.forEach((d: any) => {
          const x = d.data();
          lista.push({
            timestamp: x.timestamp || '', usuario: x.usuario || '', acao: x.acao || '',
            modulo: x.modulo || '', detalhes: x.detalhes || '', ref: x.ref,
          });
        });
        setLinhas(lista);
      },
      // Sem permissão (regra ainda não publicada) ou sem rede: o "Meu dia"
      // continua funcionando, só sem a parte "do sistema".
      () => setLinhas([]),
    );
    return () => unsub();
  }, [email]);

  return linhas;
}
