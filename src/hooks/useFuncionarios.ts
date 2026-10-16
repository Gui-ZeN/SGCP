import { useState, useEffect } from 'react';
import {
  db, isFirebaseEnabled, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from '../lib/firebase';
import { Funcionario } from '../types';
import { stripUndefinedFields } from '../lib/firestoreData';
import { colecaoDoLeitor } from './useFirestoreCollection';
import { escopoAoGravar, escopoDaSede, SEM_ISOLAMENTO, type IsolamentoUnidade } from '../utils/unidade';

const LOCAL_KEY = 'sgcp_funcionarios_fallback';

/**
 * Cadastro de funcionários (roster) — fundação do "avisar aniversários ao RH".
 * Assina a coleção `funcionarios` quando logado; fallback local (offline/demo).
 * Isolada por unidade no servidor (14/10/2026): lê só a própria e carimba
 * `escopo` ao gravar (a sincronização do Cromos também carimba).
 */
/**
 * `ativo`: só assina quando alguma tela que usa o quadro foi aberta (leitura
 * sob demanda, 16/10/2026) — antes, todo login lia os ~400 funcionários.
 */
export function useFuncionarios(currentUser: any, isolamento: IsolamentoUnidade = SEM_ISOLAMENTO, ativo = true) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser) {
      if (!isolamento.pronto || !ativo) return;
      setLoading(true);
      const col = colecaoDoLeitor('funcionarios', isolamento.escopo);
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
  }, [currentUser, isolamento.escopo, isolamento.pronto, ativo]);

  const pelaSede = (f: Partial<Funcionario>) => escopoDaSede(isolamento.sedes, f.sede);
  const comEscopo = (atual: Funcionario | undefined, campos: Partial<Funcionario>) => {
    const e = escopoAoGravar<any>(isolamento.escopo, pelaSede, atual, campos);
    return e ? { ...campos, escopo: e } : campos;
  };

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

  // Gravações gateiam por isFirebaseEnabled (constante), não pelo estado
  // `usingFirebase` (que vira false quando uma leitura falha) — senão as escritas
  // iam parar no localStorage e a coleção nunca era criada no servidor. Erros propagam.
  const addFuncionario = async (input: Omit<Funcionario, 'id'>) => {
    if (isFirebaseEnabled && db) {
      await addDoc(collection(db, 'funcionarios'), stripUndefinedFields(comEscopo(undefined, input) as any));
    } else {
      persistLocal([{ ...input, id: `local_${Date.now()}` } as Funcionario, ...funcionarios]);
    }
  };

  const updateFuncionario = async (id: string, fields: Partial<Funcionario>) => {
    if (isFirebaseEnabled && db) {
      await updateDoc(doc(db, 'funcionarios', id), stripUndefinedFields(comEscopo(funcionarios.find(f => f.id === id), fields) as any));
    } else {
      persistLocal(funcionarios.map(f => (f.id === id ? { ...f, ...fields } : f)));
    }
  };

  const deleteFuncionario = async (id: string) => {
    if (isFirebaseEnabled && db) {
      await deleteDoc(doc(db, 'funcionarios', id));
    } else {
      persistLocal(funcionarios.filter(f => f.id !== id));
    }
  };

  return { funcionarios, loading, usingFirebase, addFuncionario, updateFuncionario, deleteFuncionario };
}
