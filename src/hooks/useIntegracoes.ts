import { useState, useEffect } from 'react';
import {
  db, isFirebaseEnabled, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  handleFirestoreError, OperationType
} from '../lib/firebase';
import { Integracao } from '../types';
import type { ImportableIntegracao } from '../lib/integracaoImport';

const LOCAL_KEY = 'sgcp_integracoes_fallback';

/**
 * Treinamentos de Integração (onboarding) — módulo exclusivo da Universidade.
 * Assina `integracoes` quando logado; fallback local (offline/demo).
 * A visibilidade (só Universidade + admin) é aplicada na UI/nav.
 */
export function useIntegracoes(currentUser: any, enabled: boolean = true) {
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  useEffect(() => {
    if (!enabled) { setIntegracoes([]); setLoading(false); return; }
    if (isFirebaseEnabled && db && currentUser) {
      setLoading(true);
      const col = collection(db, 'integracoes');
      const unsub = onSnapshot(col, (snap: any) => {
        const list: Integracao[] = [];
        snap.forEach((d: any) => list.push({ ...d.data(), id: d.id } as Integracao));
        // Mais recentes primeiro (admissão DD/MM/YYYY → compara invertido AAAA/MM/DD)
        const key = (s?: string) => (s || '').split('/').reverse().join('');
        list.sort((a, b) => key(b.admissao).localeCompare(key(a.admissao)));
        setIntegracoes(list);
        setLoading(false);
      }, () => loadLocal());
      return () => unsub();
    } else {
      loadLocal();
    }
  }, [currentUser, enabled]);

  const loadLocal = () => {
    setUsingFirebase(false);
    try {
      const stored = localStorage.getItem(LOCAL_KEY);
      setIntegracoes(stored ? (JSON.parse(stored) as Integracao[]) : []);
    } catch {
      setIntegracoes([]);
    }
    setLoading(false);
  };

  const persistLocal = (list: Integracao[]) => {
    setIntegracoes(list);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (e) {}
  };

  const addIntegracao = async (input: ImportableIntegracao) => {
    if (usingFirebase && db) {
      try { await addDoc(collection(db, 'integracoes'), input as any); }
      catch (e) { handleFirestoreError(e, OperationType.CREATE, 'integracoes'); }
    } else {
      persistLocal([{ ...input, id: `local_${Date.now()}` } as Integracao, ...integracoes]);
    }
  };

  const updateIntegracao = async (id: string, fields: Partial<Integracao>) => {
    if (usingFirebase && db) {
      try { await updateDoc(doc(db, 'integracoes', id), fields as any); }
      catch (e) { handleFirestoreError(e, OperationType.UPDATE, `integracoes/${id}`); }
    } else {
      persistLocal(integracoes.map(x => (x.id === id ? { ...x, ...fields } : x)));
    }
  };

  const deleteIntegracao = async (id: string) => {
    if (usingFirebase && db) {
      try { await deleteDoc(doc(db, 'integracoes', id)); }
      catch (e) { handleFirestoreError(e, OperationType.DELETE, `integracoes/${id}`); }
    } else {
      persistLocal(integracoes.filter(x => x.id !== id));
    }
  };

  /** Import em lote com dedupe por (nome+sede) contra o que já existe. */
  const importIntegracoes = async (list: ImportableIntegracao[]): Promise<{ adicionadas: number; puladas: number }> => {
    const chave = (x: { nome: string; sede: string }) => `${x.nome.toLowerCase().trim()}|${x.sede.toLowerCase()}`;
    const existentes = new Set(integracoes.map(chave));
    const aceitos: ImportableIntegracao[] = [];
    let puladas = 0;
    for (const item of list) {
      if (existentes.has(chave(item))) { puladas++; continue; }
      existentes.add(chave(item));
      aceitos.push(item);
      if (usingFirebase && db) {
        try { await addDoc(collection(db, 'integracoes'), item as any); }
        catch (e) { handleFirestoreError(e, OperationType.CREATE, 'integracoes'); }
      }
    }
    if (!usingFirebase && aceitos.length) {
      const novos = aceitos.map((i, idx) => ({ ...i, id: `local_imp_${Date.now()}_${idx}` } as Integracao));
      persistLocal([...novos, ...integracoes]);
    }
    return { adicionadas: aceitos.length, puladas };
  };

  return { integracoes, loading, usingFirebase, addIntegracao, updateIntegracao, deleteIntegracao, importIntegracoes };
}
