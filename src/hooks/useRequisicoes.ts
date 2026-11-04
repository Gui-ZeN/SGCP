import { useState, useEffect } from 'react';
import { db, isFirebaseEnabled, collection, onSnapshot, updateDoc, doc, query, where, writeBatch } from '../lib/firebase';
import { stripUndefinedFields } from '../lib/firestoreData';
import { Requisicao } from '../types';
import { requisicaoParaVaga } from '../utils/requisicao';

/**
 * Requisições de abertura de vaga: as do formulário público e as do Orkestria.
 * Só carrega quando `canSee`. `unidade` null = Administrador, tudo; com unidade,
 * só as dela — as Rules negam a leitura da coleção inteira a quem não é Admin.
 */
export function useRequisicoes(currentUser: any, canSee: boolean = false, unidade: 'colegio' | 'universidade' | null = null) {
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);

  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser && canSee) {
      const col = collection(db, 'requisicoes');
      const alvo = unidade ? query(col, where('escopo', '==', unidade)) : col;
      const unsub = onSnapshot(alvo, (snap: any) => {
        const list: Requisicao[] = [];
        snap.forEach((d: any) => list.push({ ...d.data(), id: d.id } as Requisicao));
        list.sort((a, b) => (b.criadaEm || '').localeCompare(a.criadaEm || ''));
        setRequisicoes(list);
      }, () => setRequisicoes([]));
      return () => unsub();
    } else {
      setRequisicoes([]);
    }
  }, [currentUser, canSee, unidade]);

  // O erro sobe: com várias pessoas decidindo, a recusa negada (outra já aceitou)
  // aparecia como feita e gravava no log uma recusa que não houve.
  const updateRequisicao = async (id: string, fields: Partial<Requisicao>) => {
    if (isFirebaseEnabled && db) await updateDoc(doc(db, 'requisicoes', id), fields as any);
  };

  /**
   * Aceita um pedido de outro sistema: a vaga nasce com o número que ele já
   * recebeu e o id do caso, no MESMO lote da decisão. Ou as duas gravam, ou
   * nenhuma; aceitar de novo é negado pelas Rules (o pedido já não está
   * pendente). Erro sobe para quem chama: "não gravou" não pode parecer aceito.
   */
  const aceitarPedidoExterno = async (req: Requisicao, decididaPor: string) => {
    if (!isFirebaseEnabled || !db) return;
    const lote = writeBatch(db);
    lote.set(doc(db, 'vagas', req.id), stripUndefinedFields({ ...requisicaoParaVaga(req), codigo: req.vagaCodigo } as any));
    lote.update(doc(db, 'requisicoes', req.id), { status: 'aceita', decididaEm: new Date().toISOString(), decididaPor, vagaId: req.id });
    await lote.commit();
  };

  return { requisicoes, updateRequisicao, aceitarPedidoExterno };
}
