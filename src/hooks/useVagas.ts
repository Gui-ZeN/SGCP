/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
  OperationType
} from '../lib/firebase';
import type { ImportableVaga } from '../lib/spreadsheetImport';
import { stripUndefinedFields } from '../lib/firestoreData';

const LOCAL_STORAGE_KEY = 'ats_vagas_fallback';

export function useVagas(user?: any) {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Só assina o Firestore quando há usuário autenticado (as regras exigem auth).
  // Re-assina quando o usuário muda (login/logout).
  useEffect(() => {
    if (isFirebaseEnabled && db && user) {
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
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(firestoreList));
        setLoading(false);
      }, (error: any) => {
        // Não lançar aqui: lançar deixava o app preso em "loading". Apenas registra
        // e cai no fallback local (que libera o loading).
        console.warn('Erro ao ler vagas do Firestore, usando local fallback:', error);
        setErrorMessage("Erro ao conectar com Firestore. Redirecionando para banco local.");
        loadLocalFallback();
      });

      return () => unsubscribe();
    } else if (!isFirebaseEnabled) {
      loadLocalFallback();
    } else {
      // Firebase ativo, mas sem usuário autenticado: não assina (evita
      // permission-denied) e libera o loading para o app exibir a tela de login.
      setVagas([]);
      setLoading(false);
    }
  }, [user]);

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
      const isCleanMode = localStorage.getItem('ats_db_clean_mode') === 'true';
      const initial = isCleanMode ? [] : initialVagas.map((v, index) => ({
        id: `local_vaga_${index + 1}`,
        ...v
      } as Vaga));
      
      const seeded = [...initial];
      seeded.sort((a, b) => b.codigo - a.codigo);
      setVagas(seeded);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(seeded));
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
      // Marca o início da etapa atual na criação, p/ o "dias nesta etapa" começar do 0.
      etapaDesde: vagaInput.etapaDesde || new Date().toISOString().slice(0, 10),
    };

    if (usingFirebase && db) {
      try {
        const vagasCollection = collection(db, 'vagas');
        await addDoc(vagasCollection, stripUndefinedFields(novaVaga as any));
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
    // Carimba etapaDesde automaticamente quando a etapa MUDA (e o chamador não
    // definiu), pro "dias nesta etapa" nascer preciso em qualquer caminho (modal
    // de edição, kanban por status, ações rápidas). Só quando muda de fato — assim
    // editar outros campos não reseta o cronômetro da etapa.
    const fields: Partial<Vaga> = { ...updatedFields };
    const current = vagas.find(v => v.id === id);
    if (
      fields.etapa !== undefined &&
      fields.etapaDesde === undefined &&
      current && fields.etapa !== current.etapa
    ) {
      fields.etapaDesde = new Date().toISOString().slice(0, 10);
    }

    // Congela/retoma o relógio do SLA ao pausar/retomar a vaga. Detecta a
    // transição comparando com o status atual (só age em mudança real).
    if (fields.status !== undefined && current) {
      const PAUSADO = ['PAUSADA', 'SUSPENSA'];
      const eraPausada = PAUSADO.includes(current.status as string);
      const seraPausada = PAUSADO.includes(fields.status as string);
      const hoje = new Date().toISOString().slice(0, 10);
      if (!eraPausada && seraPausada && fields.pausadaDesde === undefined) {
        // começou a pausa agora → marca o início (o SLA para de contar a partir daqui)
        fields.pausadaDesde = hoje;
      } else if (eraPausada && !seraPausada) {
        // retomou → acumula o período pausado e limpa o marcador
        if (current.pausadaDesde) {
          const ini = new Date(current.pausadaDesde).getTime();
          const fim = new Date(hoje).getTime();
          if (!isNaN(ini)) {
            const dias = Math.max(0, Math.floor((fim - ini) / 86400000));
            fields.diasPausados = (current.diasPausados || 0) + dias;
          }
        }
        fields.pausadaDesde = '';
      }
    }

    if (usingFirebase && db) {
      try {
        const docRef = doc(db, 'vagas', id);
        // Clean out ID/code changes to avoid security rule violations
        const filteredPayload: any = { ...fields };
        delete filteredPayload.id;
        delete filteredPayload.codigo;
        // Remove campos undefined: o updateDoc do Firestore lança erro com
        // qualquer valor undefined (era a causa do "Erro no processamento" ao
        // editar vagas pelo modal, que envia o objeto completo).
        await updateDoc(docRef, stripUndefinedFields(filteredPayload));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `vagas/${id}`);
      }
    } else {
      // Local fallback CRUD
      const updatedList = vagas.map(v => {
        if (v.id === id) {
          return { ...v, ...fields };
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

  const importVagas = async (imported: ImportableVaga[], replace = false) => {
    if (imported.length === 0) return;

    if (usingFirebase && db) {
      try {
        if (replace) {
          const snap = await getDocs(collection(db, 'vagas'));
          await Promise.all(snap.docs.map((docSnap: any) => deleteDoc(doc(db, 'vagas', docSnap.id))));
        }

        const existingCodes = replace ? new Set<number>() : new Set(vagas.map(v => v.codigo));
        const toCreate = imported.filter(v => !existingCodes.has(v.codigo));
        await Promise.all(toCreate.map(({ id, ...vaga }: any) => addDoc(collection(db, 'vagas'), stripUndefinedFields(vaga))));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'vagas/import');
      }
    } else {
      const existingCodes = replace ? new Set<number>() : new Set(vagas.map(v => v.codigo));
      const toCreate = imported
        .filter(v => !existingCodes.has(v.codigo))
        .map((v, index) => ({ id: `local_import_vaga_${Date.now()}_${index}`, ...v } as Vaga));
      const updatedList = replace ? toCreate : [...toCreate, ...vagas];
      updatedList.sort((a, b) => b.codigo - a.codigo);
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
    deleteVaga,
    importVagas
  };
}
