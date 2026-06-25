import { useState, useEffect } from 'react';
import {
  db, isFirebaseEnabled, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  handleFirestoreError, OperationType
} from '../lib/firebase';
import { Funcionario } from '../types';

const LOCAL_KEY = 'sgcp_funcionarios_fallback';

/**
 * Cadastro de funcionários (roster) — fundação do "avisar aniversários ao RH".
 * Assina a coleção `funcionarios` quando logado; fallback local (offline/demo).
 * O escopo por unidade (Colégio × Universidade) é aplicado na UI, como nas vagas.
 */
export function useFuncionarios(currentUser: any) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser) {
      setLoading(true);
      const col = collection(db, 'funcionarios');
      const unsub = onSnapshot(col, (snap: any) => {
        const list: Funcionario[] = [];
        snap.forEach((d: any) => list.push({ ...d.data(), id: d.id } as Funcionario));
        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        setFuncionarios(list);
        setLoading(false);
      }, () => loadLocal());
      return () => unsub();
    } else {
      loadLocal();
    }
  }, [currentUser]);

  const loadLocal = () => {
    setUsingFirebase(false);
    try {
      const stored = localStorage.getItem(LOCAL_KEY);
      setFuncionarios(stored ? (JSON.parse(stored) as Funcionario[]) : []);
    } catch {
      setFuncionarios([]);
    }
    setLoading(false);
  };

  const persistLocal = (list: Funcionario[]) => {
    setFuncionarios(list);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (e) {}
  };

  const addFuncionario = async (input: Omit<Funcionario, 'id'>) => {
    if (usingFirebase && db) {
      try { await addDoc(collection(db, 'funcionarios'), input as any); }
      catch (e) { handleFirestoreError(e, OperationType.CREATE, 'funcionarios'); }
    } else {
      persistLocal([{ ...input, id: `local_${Date.now()}` } as Funcionario, ...funcionarios]);
    }
  };

  const updateFuncionario = async (id: string, fields: Partial<Funcionario>) => {
    if (usingFirebase && db) {
      try { await updateDoc(doc(db, 'funcionarios', id), fields as any); }
      catch (e) { handleFirestoreError(e, OperationType.UPDATE, `funcionarios/${id}`); }
    } else {
      persistLocal(funcionarios.map(f => (f.id === id ? { ...f, ...fields } : f)));
    }
  };

  const deleteFuncionario = async (id: string) => {
    if (usingFirebase && db) {
      try { await deleteDoc(doc(db, 'funcionarios', id)); }
      catch (e) { handleFirestoreError(e, OperationType.DELETE, `funcionarios/${id}`); }
    } else {
      persistLocal(funcionarios.filter(f => f.id !== id));
    }
  };

  return { funcionarios, loading, usingFirebase, addFuncionario, updateFuncionario, deleteFuncionario };
}
