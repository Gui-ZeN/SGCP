import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  db, 
  isFirebaseEnabled, 
  collection,
  onSnapshot,
  addDoc,
  getDocs,
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
 * Janela AO VIVO dos logs (16/10/2026). O log cresce sem parar (~800 por mês
 * em out/2026) e era lido inteiro a cada abertura de Vagas, Resumo ou Admin.
 * A escuta passa a trazer só os últimos 45 dias — o histórico das vagas em
 * andamento e a auditoria do dia a dia. O resto vem SOB DEMANDA, uma leitura
 * só (`carregarAnteriores`): o ano, para o acumulado do Resumo do Dia; tudo,
 * para a Auditoria, a vaga antiga e a reconstrução de pausas.
 */
const DIAS_AO_VIVO = 45;
export type AlcanceLogs = 'recentes' | 'ano' | 'tudo';
/**
 * A faixa [desde, ate) de logs que ainda falta buscar para chegar ao pedido.
 * null = já está carregado; 'nada' = o pedido já cabe na janela ao vivo (ex.:
 * em janeiro, o "ano" inteiro está nos 45 dias). Datas em ISO (comparam como texto).
 */
export function faixaQueFalta(alcance: AlcanceLogs, pedido: 'ano' | 'tudo', corte: string, inicioDoAno: string):
  { desde: string; ate: string } | 'nada' | null {
  if (alcance === 'tudo' || (alcance === 'ano' && pedido === 'ano')) return null;
  // 'tudo' depois de 'ano' só busca o que vem antes do ano (ou da janela, se ela começa antes).
  const ate = alcance === 'ano' && inicioDoAno < corte ? inicioDoAno : corte;
  const desde = pedido === 'ano' ? inicioDoAno : '';
  return desde && desde >= ate ? 'nada' : { desde, ate };
}

const porData = (a: SystemLog, b: SystemLog) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

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
  const [recentes, setRecentes] = useState<SystemLog[]>([]);
  const [anteriores, setAnteriores] = useState<SystemLog[]>([]);
  const [alcance, setAlcance] = useState<AlcanceLogs>('recentes');
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);
  // ISO de 45 dias atrás, fixo na sessão: a janela não "anda" sozinha (e o que
  // fica antes dela já está em `anteriores` se alguém pediu).
  const corte = useMemo(() => new Date(Date.now() - DIAS_AO_VIVO * 864e5).toISOString(), []);
  const logs = useMemo(() => (anteriores.length ? [...recentes, ...anteriores] : recentes), [recentes, anteriores]);
  const setLogs = setRecentes;
  const recentesRef = useRef(recentes); recentesRef.current = recentes;
  const anterioresRef = useRef(anteriores); anterioresRef.current = anteriores;

  // Synchronize system logs
  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser && canSeeLogs) {
      if (!isolamento.pronto) return;
      setLoading(true);
      // Coordenador: unidade + data — exige o índice composto (escopo,
      // timestamp) de firestore.indexes.json.
      const logsCollection = isolamento.leitura
        ? query(collection(db, 'logs'), where('escopo', '==', isolamento.leitura), where('timestamp', '>=', corte))
        : query(collection(db, 'logs'), where('timestamp', '>=', corte));
      
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
  }, [currentUser, canSeeLogs, isolamento.leitura, isolamento.pronto, corte]);

  /**
   * Busca, UMA vez, os logs anteriores à janela ao vivo: 'ano' (desde 1º de
   * janeiro) ou 'tudo'. Devolve a lista completa até ali — quem precisa dela
   * na hora (reconstrução de pausas) não espera o próximo render.
   */
  const alcanceRef = useRef(alcance); alcanceRef.current = alcance;
  const carregarAnteriores = async (pedido: 'ano' | 'tudo'): Promise<SystemLog[]> => {
    const atual = () => [...recentesRef.current, ...anterioresRef.current];
    if (!isFirebaseEnabled || !db || !currentUser || !canSeeLogs) return atual();
    const faixa = faixaQueFalta(alcanceRef.current, pedido, corte, `${new Date().getFullYear()}-01-01`);
    if (!faixa) return atual();
    // Marca já (ref): duas chamadas seguidas não buscam a mesma faixa duas vezes.
    alcanceRef.current = pedido;
    if (faixa === 'nada') { setAlcance(pedido); return atual(); }
    const { desde, ate } = faixa;
    const filtros = [
      ...(isolamento.leitura ? [where('escopo', '==', isolamento.leitura)] : []),
      where('timestamp', '<', ate),
      ...(desde ? [where('timestamp', '>=', desde)] : []),
    ];
    const snap = await getDocs(query(collection(db, 'logs'), ...filtros));
    const novos: SystemLog[] = [];
    snap.forEach((d: any) => novos.push({ ...d.data(), id: d.id } as SystemLog));
    const juntos = [...anterioresRef.current, ...novos].sort(porData);
    setAnteriores(juntos);
    setAlcance(pedido);
    return [...recentesRef.current, ...juntos];
  };

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
    logAction,
    /** Até onde os logs carregados vão: os 45 dias ao vivo, o ano, ou tudo. */
    alcance: isFirebaseEnabled ? alcance : 'tudo' as AlcanceLogs,
    /** Data (ISO) em que começa a janela ao vivo. */
    corte,
    carregarAnteriores,
  };
}
