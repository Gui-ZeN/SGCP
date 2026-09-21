import { useState, useEffect } from 'react';
import { db, isFirebaseEnabled, onSnapshot, doc, setDoc } from '../lib/firebase';

const LOCAL_KEY = 'sgcp_app_config';

/**
 * Configuração GLOBAL do app (doc `config/ui`), visível a todos os usuários e
 * editável só por admin (ver firestore.rules). Hoje guarda os "enfeites de época"
 * (ex.: bandeirinhas de São João) — um mapa id→ligado. Fallback local (offline).
 */
export interface Notificacoes {
  /** Quem recebe o e-mail das Seleções do dia (18h de Fortaleza). */
  destinatariosSelecoes: string[];
  /** Liga/desliga o disparo sem precisar apagar a lista. */
  selecoesAtivo: boolean;
  /**
   * Resultado da ÚLTIMA execução do disparo, gravado pela própria função.
   *
   * Existe porque sucesso e falha eram indistinguíveis de fora: a evidência de
   * sucesso é um e-mail na caixa de outra pessoa, e a de falha é silêncio — o
   * mesmo silêncio de um dia sem seleção. Levou três dias para alguém notar
   * que o disparo de 17/09/2026 tinha morrido.
   */
  ultimoDisparo?: {
    quando?: string;         // ISO
    dia?: string;            // DD/MM/AAAA do resumo
    enviado?: boolean;
    motivo?: string;
    destinatarios?: number;
    assunto?: string;
  };
}

const NOTIF_VAZIO: Notificacoes = { destinatariosSelecoes: [], selecoesAtivo: true };

export function useAppConfig(currentUser: any) {
  const [enfeites, setEnfeites] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}').enfeites || {}; } catch { return {}; }
  });
  const [notificacoes, setNotificacoes] = useState<Notificacoes>(() => {
    try { return { ...NOTIF_VAZIO, ...(JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}').notificacoes || {}) }; }
    catch { return NOTIF_VAZIO; }
  });

  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser) {
      const ref = doc(db, 'config', 'ui');
      const unsub = onSnapshot(ref, (snap: any) => {
        setEnfeites((snap.data()?.enfeites) || {});
      }, () => { /* sem acesso/erro: mantém o que tem */ });

      // Doc separado do `ui` de propósito: a função de e-mail (cron, sem
      // usuário logado) lê SÓ `config/notificacoes` com a conta de serviço —
      // quanto menor o documento que ela alcança, menor o estrago possível.
      const refNotif = doc(db, 'config', 'notificacoes');
      const unsubNotif = onSnapshot(refNotif, (snap: any) => {
        setNotificacoes({ ...NOTIF_VAZIO, ...(snap.data() || {}) });
      }, () => { /* idem */ });

      return () => { unsub(); unsubNotif(); };
    }
  }, [currentUser]);

  const salvarNotificacoes = async (novo: Notificacoes) => {
    setNotificacoes(novo); // otimista
    // `ultimoDisparo` é escrito pela função das 18h, não pela tela. Mandá-lo de
    // volta aqui sobrescreveria um registro mais novo pela cópia que o
    // navegador tinha em mãos.
    const { ultimoDisparo: _naoEhMeu, ...meus } = novo;
    if (isFirebaseEnabled && db) {
      try { await setDoc(doc(db, 'config', 'notificacoes'), meus, { merge: true }); }
      catch (e) { console.error('Erro ao salvar notificações:', e); throw e; }
    } else {
      try {
        const atual = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...atual, notificacoes: novo }));
      } catch (e) {}
    }
  };

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

  return { enfeites, setEnfeite, notificacoes, salvarNotificacoes };
}
