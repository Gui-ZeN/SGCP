/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hook genérico de coleção Firestore com fallback para localStorage.
 * Centraliza o padrão repetido em useVagas/useMetadata/useOperationalModules:
 * listener realtime (onSnapshot) -> estado + cache local; modo offline lendo
 * do localStorage e semeando defaults; e CRUD (create/update/remove) com as
 * duas vias (Firestore e local). Transformações específicas de cada entidade
 * (gerar código, recalcular datas, etc.) ficam no consumidor, que chama
 * create/update já com o corpo pronto.
 */

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  db,
  isFirebaseEnabled,
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { stripUndefinedFields } from '../lib/firestoreData';

const CLEAN_MODE_KEY = 'ats_db_clean_mode';

export interface UseFirestoreCollectionOptions<T> {
  collectionName: string;
  localKey: string;
  /** Registros semeados na primeira execução offline (ignorados em clean mode). */
  seed?: T[];
  /** Ordenação aplicada à lista (no listener e nas mutações locais). */
  sort?: (a: T, b: T) => number;
  /** Gera o id local quando offline. */
  newLocalId: () => string;
  /** Posição da inserção local (true = início). Default true. */
  prepend?: boolean;
  /** Campos extras a remover no update (além de 'id'), ex.: 'codigo'. */
  stripOnUpdate?: (keyof T)[];
  /**
   * Habilita a assinatura do Firestore (true quando há usuário autenticado).
   * Com Firebase ativo e enabled=false, não assina (evita permission-denied) e
   * libera o loading. Default true (preserva comportamento de quem não passa).
   */
  enabled?: boolean;
}

export interface UseFirestoreCollectionResult<T> {
  items: T[];
  loading: boolean;
  usingFirebase: boolean;
  setItems: Dispatch<SetStateAction<T[]>>;
  create: (body: Omit<T, 'id'>) => Promise<string | undefined>;
  update: (id: string, fields: Partial<T>) => Promise<void>;
  /**
   * Cria com id escolhido, ou mescla se já existir. Para registro de id
   * determinístico ("um por pessoa por dia"): `update` falha em documento que
   * ainda não existe, e `create` sortearia um id novo a cada gravação.
   */
  upsert: (id: string, fields: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useFirestoreCollection<T extends { id: string }>(
  opts: UseFirestoreCollectionOptions<T>
): UseFirestoreCollectionResult<T> {
  const {
    collectionName,
    localKey,
    seed = [],
    sort,
    newLocalId,
    prepend = true,
    stripOnUpdate = [],
    enabled = true
  } = opts;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  const applySort = (list: T[]): T[] => (sort ? [...list].sort(sort) : list);
  const cache = (list: T[]) => localStorage.setItem(localKey, JSON.stringify(list));

  const loadLocalFallback = () => {
    setUsingFirebase(false);
    const stored = localStorage.getItem(localKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as T[];
        setItems(applySort(Array.isArray(parsed) ? parsed : []));
      } catch {
        setItems([]);
      }
    } else {
      const isCleanMode = localStorage.getItem(CLEAN_MODE_KEY) === 'true';
      const initial = isCleanMode ? [] : seed;
      setItems(applySort(initial));
      cache(initial);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isFirebaseEnabled && db && enabled) {
      setLoading(true);
      const unsub = onSnapshot(
        collection(db, collectionName),
        (snapshot: any) => {
          const list: T[] = [];
          snapshot.forEach((docSnap: any) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as T);
          });
          const sorted = applySort(list);
          setItems(sorted);
          cache(sorted);
          setLoading(false);
        },
        (err: any) => {
          console.warn(`Erro ao ler ${collectionName} do Firestore, usando local fallback:`, err);
          loadLocalFallback();
        }
      );
      return () => unsub();
    } else if (!isFirebaseEnabled) {
      loadLocalFallback();
    } else {
      // Firebase ativo mas sem usuário autenticado: não assina (evita
      // permission-denied). Loading fica TRUE: a tela de login usa authReady, e
      // manter true evita 1 frame de shell vazio quando o login resolve (piscada).
      setItems([]);
      setLoading(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Modo local (demo/offline): toda gravação parte da lista ATUAL, não da que
  // estava na tela quando a função foi criada. ⚠️ Sem isto, gravações seguidas
  // (marcar a entrevista e já registrar 4 nomes) apagavam umas às outras: cada
  // uma partia da mesma lista velha e só a última sobrava.
  const atual = useRef(items);
  atual.current = items;
  const gravarLocal = (mudar: (lista: T[]) => T[]) => {
    const updated = applySort(mudar(atual.current));
    atual.current = updated;
    setItems(updated);
    cache(updated);
  };

  /** Devolve o id criado (ou undefined se falhou): quem cria às vezes precisa
   *  dele em seguida — a seleção marcada pelo Kanban recebe os nomes na hora. */
  const create = async (body: Omit<T, 'id'>): Promise<string | undefined> => {
    if (usingFirebase && db) {
      try {
        const ref = await addDoc(collection(db, collectionName), stripUndefinedFields(body as any));
        return ref.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, collectionName);
        return undefined;
      }
    } else {
      const newItem = { id: newLocalId(), ...(body as any) } as T;
      gravarLocal(lista => prepend ? [newItem, ...lista] : [...lista, newItem]);
      return newItem.id;
    }
  };

  const update = async (id: string, fields: Partial<T>) => {
    if (usingFirebase && db) {
      try {
        const payload: any = { ...fields };
        delete payload.id;
        for (const key of stripOnUpdate) delete payload[key as string];
        await updateDoc(doc(db, collectionName, id), stripUndefinedFields(payload));
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
      }
    } else {
      gravarLocal(lista => lista.map(it => (it.id === id ? { ...it, ...fields } : it)));
    }
  };

  const upsert = async (id: string, fields: Partial<T>) => {
    if (usingFirebase && db) {
      try {
        const payload: any = { ...fields };
        delete payload.id;
        await setDoc(doc(db, collectionName, id), stripUndefinedFields(payload), { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
      }
    } else {
      gravarLocal(lista => lista.some(it => it.id === id)
        ? lista.map(it => (it.id === id ? { ...it, ...fields } : it))
        : [...lista, { ...(fields as any), id } as T]);
    }
  };

  const remove = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
      }
    } else {
      gravarLocal(lista => lista.filter(it => it.id !== id));
    }
  };

  return { items, loading, usingFirebase, setItems, create, update, upsert, remove };
}
