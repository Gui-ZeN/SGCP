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

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  db,
  isFirebaseEnabled,
  collection,
  onSnapshot,
  addDoc,
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
}

export interface UseFirestoreCollectionResult<T> {
  items: T[];
  loading: boolean;
  usingFirebase: boolean;
  setItems: Dispatch<SetStateAction<T[]>>;
  create: (body: Omit<T, 'id'>) => Promise<void>;
  update: (id: string, fields: Partial<T>) => Promise<void>;
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
    stripOnUpdate = []
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
    if (isFirebaseEnabled && db) {
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
    } else {
      loadLocalFallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (body: Omit<T, 'id'>) => {
    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, collectionName), stripUndefinedFields(body as any));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, collectionName);
      }
    } else {
      const newItem = { id: newLocalId(), ...(body as any) } as T;
      const updated = applySort(prepend ? [newItem, ...items] : [...items, newItem]);
      setItems(updated);
      cache(updated);
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
      const updated = applySort(items.map(it => (it.id === id ? { ...it, ...fields } : it)));
      setItems(updated);
      cache(updated);
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
      const updated = items.filter(it => it.id !== id);
      setItems(updated);
      cache(updated);
    }
  };

  return { items, loading, usingFirebase, setItems, create, update, remove };
}
