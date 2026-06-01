/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Vaga } from '../types';
import { initialVagas } from '../data/initial_vagas';
import { 
  db, 
  isFirebaseEnabled, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  handleFirestoreError,
  OperationType,
  getDoc,
  setDoc
} from '../lib/firebase';

const LOCAL_STORAGE_KEY = 'ats_vagas_fallback';

export function useVagas() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    if (isFirebaseEnabled && db) {
      setLoading(true);
      const vagasCollection = collection(db, 'vagas');
      
      // Setup realtime Firestore synchronization
      const unsubscribe = onSnapshot(vagasCollection, (snapshot: any) => {
        const firestoreList: Vaga[] = [];
        snapshot.forEach((docSnap: any) => {
          firestoreList.push({ ...docSnap.data(), id: docSnap.id } as Vaga);
        });
        
        // Sort by code descending so newest are on top
        firestoreList.sort((a, b) => b.codigo - a.codigo);
        
        setVagas(firestoreList);
        setLoading(false);
      }, (error: any) => {
        handleFirestoreError(error, OperationType.LIST, 'vagas');
        setErrorMessage("Erro ao conectar com Firestore. Redirecionando para banco local.");
        loadLocalFallback();
      });

      return () => unsubscribe();
    } else {
      loadLocalFallback();
    }
  }, []);

  // Local fallback engine using localStorage and initial JSON data
  const loadLocalFallback = () => {
    setUsingFirebase(false);
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Vaga[];
        parsed.sort((a, b) => b.codigo - a.codigo);
        setVagas(parsed);
      } catch (err) {
        setVagas([]);
      }
    } else {
      setVagas([]);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
    }
    setLoading(false);
  };

  // Add a new vacancy (Full-Stack CRUD supporting both online Firestore and Local Fallback)
  const addVaga = async (vagaInput: Omit<Vaga, 'id' | 'codigo'>) => {
    const nextCodigo = vagas.length > 0 ? Math.max(...vagas.map(v => v.codigo)) + 1 : 1001;
    
    const novaVaga: Omit<Vaga, 'id'> = {
      codigo: nextCodigo,
      ...vagaInput,
      ano: vagaInput.ano || new Date().getFullYear(),
    };

    if (usingFirebase && db) {
      try {
        const vagasCollection = collection(db, 'vagas');
        await addDoc(vagasCollection, novaVaga);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'vagas');
      }
    } else {
      // Local fallback CRUD
      const newlyCreated: Vaga = {
        id: `local_new_${Date.now()}_${nextCodigo}`,
        ...novaVaga as Vaga
      };
      const updatedList = [newlyCreated, ...vagas];
      setVagas(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    }
  };

  // Update an existing vacancy's details or status
  const updateVaga = async (id: string, updatedFields: Partial<Vaga>) => {
    if (usingFirebase && db) {
      try {
        const docRef = doc(db, 'vagas', id);
        // Clean out ID/code changes to avoid security rule violations
        const filteredPayload = { ...updatedFields };
        delete filteredPayload.id;
        delete filteredPayload.codigo;
        await updateDoc(docRef, filteredPayload);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `vagas/${id}`);
      }
    } else {
      // Local fallback CRUD
      const updatedList = vagas.map(v => {
        if (v.id === id) {
          return { ...v, ...updatedFields };
        }
        return v;
      });
      setVagas(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    }
  };

  // Delete vacancy permanently
  const deleteVaga = async (id: string) => {
    if (usingFirebase && db) {
      try {
        const docRef = doc(db, 'vagas', id);
        await deleteDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `vagas/${id}`);
      }
    } else {
      // Local fallback CRUD
      const updatedList = vagas.filter(v => v.id !== id);
      setVagas(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    }
  };

  return {
    vagas,
    loading,
    usingFirebase,
    errorMessage,
    addVaga,
    updateVaga,
    deleteVaga
  };
}
