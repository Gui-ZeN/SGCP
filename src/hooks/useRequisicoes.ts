import { useState, useEffect } from 'react';
import { db, isFirebaseEnabled, collection, onSnapshot, updateDoc, doc } from '../lib/firebase';
import { Requisicao } from '../types';

/**
 * Requisições de abertura de vaga (criadas pelo formulário público).
 * Só carrega quando `canSee` (admin) — leitura é restrita nas regras.
 */
export function useRequisicoes(currentUser: any, canSee: boolean = false) {
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);

  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser && canSee) {
      const col = collection(db, 'requisicoes');
      const unsub = onSnapshot(col, (snap: any) => {
        const list: Requisicao[] = [];
        snap.forEach((d: any) => list.push({ ...d.data(), id: d.id } as Requisicao));
        list.sort((a, b) => (b.criadaEm || '').localeCompare(a.criadaEm || ''));
        setRequisicoes(list);
      }, () => setRequisicoes([]));
      return () => unsub();
    } else {
      setRequisicoes([]);
    }
  }, [currentUser, canSee]);

  const updateRequisicao = async (id: string, fields: Partial<Requisicao>) => {
    if (isFirebaseEnabled && db) {
      try {
        await updateDoc(doc(db, 'requisicoes', id), fields as any);
      } catch (e) {
        console.error('Erro ao atualizar requisição:', e);
      }
    }
  };

  return { requisicoes, updateRequisicao };
}
