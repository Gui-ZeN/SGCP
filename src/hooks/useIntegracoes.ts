import { useState, useEffect, useRef } from 'react';
import {
  db, isFirebaseEnabled, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch
} from '../lib/firebase';
import { Integracao } from '../types';
import { stripUndefinedFields } from '../lib/firestoreData';
import type { ImportableIntegracao } from '../lib/integracaoImport';

const LOCAL_KEY = 'sgcp_integracoes_fallback';

// Migração única: o primeiro import gravou a aba Benfica com a sede
// "BENFICA UNIVERSIDADE" (nome antigo); a sede real do cadastro é UNIBENFICA.
// Registros legados são renomeados ao carregar. Removível depois de rodar em produção.
const LEGACY_SEDES: Record<string, string> = { 'BENFICA UNIVERSIDADE': 'UNIBENFICA' };

/**
 * Treinamentos de Integração (onboarding) — módulo exclusivo da Universidade.
 * Assina `integracoes` quando logado; fallback local (offline/demo).
 * A visibilidade (só Universidade + admin) é aplicada na UI/nav.
 */
export function useIntegracoes(currentUser: any, enabled: boolean = true) {
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);
  const migrouSedesLegadas = useRef(false);

  useEffect(() => {
    if (!enabled) { setIntegracoes([]); setLoading(false); return; }
    if (isFirebaseEnabled && db && currentUser) {
      setLoading(true);
      const col = collection(db, 'integracoes');
      const unsub = onSnapshot(col, (snap: any) => {
        const list: Integracao[] = [];
        snap.forEach((d: any) => list.push({ ...d.data(), id: d.id } as Integracao));

        // Auto-correção de sedes legadas (uma vez por sessão). O update dispara um
        // novo snapshot já corrigido — na 2ª passada nada casa e o loop encerra.
        if (!migrouSedesLegadas.current) {
          const legadas = list.filter(x => LEGACY_SEDES[x.sede]);
          if (legadas.length) {
            migrouSedesLegadas.current = true;
            legadas.forEach(x => {
              updateDoc(doc(db, 'integracoes', x.id), { sede: LEGACY_SEDES[x.sede] })
                .catch((e: any) => console.warn('Migração de sede legada falhou:', x.id, e));
            });
          }
        }

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

  // IMPORTANTE: as GRAVAÇÕES gateiam por isFirebaseEnabled (constante), NÃO por
  // `usingFirebase` (estado que vira false quando uma LEITURA falha). Antes, uma
  // leitura negada jogava todas as escritas pro localStorage — a coleção nunca
  // era criada no servidor e sumia no F5. Erros propagam (o chamador mostra).
  const addIntegracao = async (input: ImportableIntegracao) => {
    if (isFirebaseEnabled && db) {
      await addDoc(collection(db, 'integracoes'), stripUndefinedFields(input as any));
    } else {
      persistLocal([{ ...input, id: `local_${Date.now()}` } as Integracao, ...integracoes]);
    }
  };

  const updateIntegracao = async (id: string, fields: Partial<Integracao>) => {
    if (isFirebaseEnabled && db) {
      await updateDoc(doc(db, 'integracoes', id), stripUndefinedFields(fields as any));
    } else {
      persistLocal(integracoes.map(x => (x.id === id ? { ...x, ...fields } : x)));
    }
  };

  const deleteIntegracao = async (id: string) => {
    if (isFirebaseEnabled && db) {
      await deleteDoc(doc(db, 'integracoes', id));
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
    }
    // writeBatch (lotes de ≤450): centenas de registros em segundos, em vez de
    // uma ida ao servidor por doc. IMPORTANTE: strip de undefined (o Firestore
    // rejeita) e SEM engolir o erro — se o commit falhar, propaga p/ o chamador
    // mostrar a mensagem real (antes o catch silencioso escondia o motivo).
    if (isFirebaseEnabled && db && aceitos.length) {
      for (let i = 0; i < aceitos.length; i += 450) {
        const batch = writeBatch(db);
        aceitos.slice(i, i + 450).forEach(item => batch.set(doc(collection(db, 'integracoes')), stripUndefinedFields(item as any)));
        await batch.commit();
      }
    }
    if (!isFirebaseEnabled && aceitos.length) {
      const novos = aceitos.map((i, idx) => ({ ...i, id: `local_imp_${Date.now()}_${idx}` } as Integracao));
      persistLocal([...novos, ...integracoes]);
    }
    return { adicionadas: aceitos.length, puladas };
  };

  return { integracoes, loading, usingFirebase, addIntegracao, updateIntegracao, deleteIntegracao, importIntegracoes };
}
