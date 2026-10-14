import { useState, useEffect } from 'react';
import { 
  db, 
  isFirebaseEnabled, 
  collection,
  onSnapshot,
  addDoc,
  query,
  where
} from '../lib/firebase';
import type { Escopo } from '../utils/unidade';

export interface SystemLog {
  id: string;
  timestamp: string; // ISO String
  usuario: string; // Email of the user who performed the log
  acao: 'CRIOU' | 'ALTEROU' | 'EXCLUIU' | 'SINALIZOU'; 
  modulo: 'Vagas' | 'Sedes' | 'Regiões' | 'Cargos' | 'Setores' | 'Usuários' | 'Treinamentos' | 'Experiências' | 'Entrevistas' | 'Turnover' | 'Integrações' | 'Consultas' | 'Organograma' | 'Resumo do Dia' | 'Seleções' | 'Candidatos';
  detalhes: string;
  regiao?: string; // região de quem realizou a ação (histórico; o recorte agora é o `escopo`)
  /** Unidade do log — a regra do banco só entrega ao Coordenador a dele. */
  escopo?: Escopo;
  /** Campos da ação, para o relato diário escrever frases. Ver `logAction`. */
  ref?: Record<string, string | number>;
}

const LOCAL_STORAGE_KEY = 'ats_system_logs_fallback';

/**
 * `isolamento.leitura`: unidade de quem lê (null = Administrador, lê tudo). O
 * Coordenador pede ao banco só os logs da unidade dele — a regra nega o resto.
 * `isolamento.autor`: unidade gravada nos logs, quando a ação não diz outra.
 */
export function useLogs(
  currentUser: any,
  canSeeLogs: boolean = false,
  actorRegiao: string = '',
  isolamento: { leitura: Escopo | null; autor: Escopo; pronto: boolean } = { leitura: null, autor: 'colegio', pronto: true }
) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  // Synchronize system logs
  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser && canSeeLogs) {
      if (!isolamento.pronto) return;
      setLoading(true);
      const logsCollection = isolamento.leitura
        ? query(collection(db, 'logs'), where('escopo', '==', isolamento.leitura))
        : collection(db, 'logs');
      
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
  }, [currentUser, canSeeLogs, isolamento.leitura, isolamento.pronto]);

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
  /**
   * @param opcoes.ref  os CAMPOS da ação (cargo, sede, números, nome do item).
   *   É deles que o relato diário por pessoa monta as frases — o texto de
   *   `detalhes` é para o histórico do Admin, e reaproveitá-lo no e-mail fez o
   *   relatório "parecer log". Campo vazio é removido: o Firestore recusa
   *   `undefined` e a gravação do log inteiro falharia por causa dele.
   *   (Substitui o antigo `overrideUser`, que nenhuma chamada usava.)
   * @param opcoes.escopo  unidade do REGISTRO afetado, quando a ação a conhece
   *   (o Admin mexe nas duas). Sem ela, vale a unidade de quem age.
   */
  const logAction = async (
    acao: 'CRIOU' | 'ALTEROU' | 'EXCLUIU' | 'SINALIZOU',
    modulo: SystemLog['modulo'],
    detalhes: string,
    opcoes: { ref?: Record<string, string | number | undefined | null>; escopo?: Escopo } = {}
  ) => {
    // Determine current user performing the action
    const email = currentUser?.email || 'sistema';
    const timestamp = new Date().toISOString();

    const ref = Object.fromEntries(
      Object.entries(opcoes.ref || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ) as Record<string, string | number>;

    const novoLog: Omit<SystemLog, 'id'> = {
      timestamp,
      usuario: email,
      acao,
      modulo,
      detalhes,
      regiao: actorRegiao || '',
      escopo: opcoes.escopo || isolamento.autor,
      ...(Object.keys(ref).length ? { ref } : {}),
    };

    if (isFirebaseEnabled && db) {
      try {
        const logsCollection = collection(db, 'logs');
        await addDoc(logsCollection, novoLog);
      } catch (error: any) {
        // ⚠️ Antes ia para o localStorage em silêncio: o log some no F5 e a
        // trilha de auditoria fica furada sem ninguém saber (revisão de
        // segurança de 14/10/2026). Agora a falha aparece para quem agiu.
        console.error("Erro ao persistir log no Firestore:", error);
        throw new Error(`A alteração foi gravada, mas o registro dela no histórico falhou (${error?.code || error?.message || error}). Recarregue a página e confira.`);
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
