import { useState, useEffect } from 'react';
import { db, isFirebaseEnabled, onSnapshot, doc, setDoc } from '../lib/firebase';

const LOCAL_KEY = 'sgcp_app_config';

/**
 * Configuração GLOBAL do app (doc `config/ui`), visível a todos os usuários e
 * editável só por admin (ver firestore.rules). Hoje guarda os "enfeites de época"
 * (ex.: bandeirinhas de São João) — um mapa id→ligado. Fallback local (offline).
 */
export function useAppConfig(currentUser: any) {
  const [enfeites, setEnfeites] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}').enfeites || {}; } catch { return {}; }
  });

  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser) {
      const ref = doc(db, 'config', 'ui');
      const unsub = onSnapshot(ref, (snap: any) => {
        setEnfeites((snap.data()?.enfeites) || {});
      }, () => { /* sem acesso/erro: mantém o que tem */ });
      return () => unsub();
    }
  }, [currentUser]);

  const setEnfeite = async (id: string, ativo: boolean) => {
    const novo = { ...enfeites, [id]: ativo };
    setEnfeites(novo); // otimista
    if (isFirebaseEnabled && db) {
      try { await setDoc(doc(db, 'config', 'ui'), { enfeites: novo }, { merge: true }); }
      catch (e) { console.error('Erro ao salvar config de enfeites:', e); }
    } else {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ enfeites: novo })); } catch (e) {}
    }
  };

  return { enfeites, setEnfeite };
}
