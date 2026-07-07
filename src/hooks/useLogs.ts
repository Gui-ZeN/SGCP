import { useState, useEffect } from 'react';
import { 
  db, 
  isFirebaseEnabled, 
  collection,
  onSnapshot,
  addDoc
} from '../lib/firebase';

export interface SystemLog {
  id: string;
  timestamp: string; // ISO String
  usuario: string; // Email of the user who performed the log
  acao: 'CRIOU' | 'ALTEROU' | 'EXCLUIU' | 'SINALIZOU'; 
  modulo: 'Vagas' | 'Sedes' | 'Regiões' | 'Cargos' | 'Setores' | 'Usuários' | 'Treinamentos' | 'Experiências' | 'Entrevistas' | 'Turnover' | 'Integrações';
  detalhes: string;
  regiao?: string; // região de quem realizou a ação — usada para escopar o histórico do Coordenador
}

const LOCAL_STORAGE_KEY = 'ats_system_logs_fallback';

export function useLogs(currentUser: any, canSeeLogs: boolean = false, actorRegiao: string = '') {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  // Synchronize system logs
  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser && canSeeLogs) {
      setLoading(true);
      const logsCollection = collection(db, 'logs');
      
      const unsubscribe = onSnapshot(logsCollection, (snapshot: any) => {
        const firestoreList: SystemLog[] = [];
        snapshot.forEach((docSnap: any) => {
          firestoreList.push({ ...docSnap.data(), id: docSnap.id } as SystemLog);
        });
        
        // Sort by timestamp descending
        firestoreList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(firestoreList);
        setLoading(false);
      }, (error: any) => {
        // Não lançar aqui: lançar (handleFirestoreError) impedia o loadLocalFallback
        // de rodar, deixando a tela de logs presa em "carregando".
        console.warn('Erro ao ler logs do Firestore, usando local fallback:', error);
        loadLocalFallback();
      });

      return () => unsubscribe();
    } else {
      loadLocalFallback();
    }
  }, [currentUser, canSeeLogs]);

  const loadLocalFallback = () => {
    setUsingFirebase(false);
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SystemLog[];
        parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(parsed);
      } catch (err) {
        setLogs([]);
      }
    } else {
      setLogs([]);
    }
    setLoading(false);
  };

  // Add a helper operation to write logs easily
  const logAction = async (
    acao: 'CRIOU' | 'ALTEROU' | 'EXCLUIU' | 'SINALIZOU',
    modulo: SystemLog['modulo'],
    detalhes: string,
    overrideUser?: string
  ) => {
    // Determine current user performing the action
    const email = overrideUser || currentUser?.email || 'sistema';
    const timestamp = new Date().toISOString();

    const novoLog: Omit<SystemLog, 'id'> = {
      timestamp,
      usuario: email,
      acao,
      modulo,
      detalhes,
      regiao: actorRegiao || ''
    };

    if (isFirebaseEnabled && db) {
      try {
        const logsCollection = collection(db, 'logs');
        await addDoc(logsCollection, novoLog);
      } catch (error) {
        // Fallback to local log entry if Firebase fails during operation
        console.error("Erro ao persistir log no Firestore, enfileirando localmente:", error);
        saveLocalLog(novoLog);
      }
    } else {
      saveLocalLog(novoLog);
    }
  };

  const saveLocalLog = (novoLog: Omit<SystemLog, 'id'>) => {
    const newlyCreated: SystemLog = {
      id: `local_log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...novoLog
    };
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    let currentLogs: SystemLog[] = [];
    if (stored) {
      try {
        currentLogs = JSON.parse(stored) as SystemLog[];
      } catch (e) {}
    }
    const updatedList = [newlyCreated, ...currentLogs];
    // Cap system logs locally at 500 to prevent local storage quota issues
    const cappedList = updatedList.slice(0, 500);
    setLogs(cappedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cappedList));
  };

  return {
    logs,
    loading,
    usingFirebase,
    logAction
  };
}
