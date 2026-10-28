/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  clearIndexedDbPersistence,
  doc, 
  getDocFromServer,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  setDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import firebaseConfig from '../firebase-applet-config.json';

// Support Vercel environment variables or local applet configs seamlessly
const finalFirebaseConfig = {
  projectId: ((import.meta as any).env?.VITE_FIREBASE_PROJECT_ID as string) || firebaseConfig?.projectId || "",
  appId: ((import.meta as any).env?.VITE_FIREBASE_APP_ID as string) || firebaseConfig?.appId || "",
  apiKey: ((import.meta as any).env?.VITE_FIREBASE_API_KEY as string) || firebaseConfig?.apiKey || "",
  authDomain: ((import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseConfig?.authDomain || "",
  firestoreDatabaseId: ((import.meta as any).env?.VITE_FIREBASE_DATABASE_ID as string) || firebaseConfig?.firestoreDatabaseId || "",
  storageBucket: ((import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseConfig?.storageBucket || "",
  messagingSenderId: ((import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseConfig?.messagingSenderId || "",
  measurementId: ((import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID as string) || firebaseConfig?.measurementId || ""
};

export let db: any = null;
export let auth: any = null;
export let googleProvider: any = null;
export let isFirebaseEnabled = false;

/**
 * Modo demonstração — `?demo=1` na URL.
 *
 * Desliga o Firebase por COMPLETO: nenhum app é inicializado, nenhuma conexão
 * com produção é aberta, nada é gravado no servidor. O app inteiro cai no
 * caminho local que já existe (seed de vagas + metadados em localStorage), e o
 * login vira simulado. É sandbox para ver UI, não um atalho de acesso: como o
 * Firebase nem sobe, não há dado real ao alcance.
 *
 * Fica gravado no localStorage para sobreviver ao F5. `?demo=0` sai do modo.
 */
const DEMO_KEY = 'ats_modo_demo';

function resolverModoDemo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const parametro = new URLSearchParams(window.location.search).get('demo');
    if (parametro === '1') localStorage.setItem(DEMO_KEY, '1');
    if (parametro === '0') localStorage.removeItem(DEMO_KEY);
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false; // navegador sem localStorage (aba privada travada)
  }
}

export const isModoDemo = resolverModoDemo();

if (isModoDemo) {
  console.log('SGPC em MODO DEMONSTRAÇÃO: Firebase desligado, dados locais de mentira. Saia com ?demo=0');
}

// Robust check to see if Firebase was fully configured
if (!isModoDemo && finalFirebaseConfig.projectId && finalFirebaseConfig.apiKey) {
  try {
    const app = getApps().length === 0 ? initializeApp(finalFirebaseConfig) : getApp();

    // App Check (auditoria de 14/10/2026, achado 5): os formulários públicos
    // gravam sem login. Com a chave do Fraud Defense (reCAPTCHA Enterprise),
    // todo pedido ao Firebase leva um atestado de que veio DESTE site; com a
    // verificação ligada no console, script solto batendo direto na API é
    // recusado. REDUZ o abuso, não elimina — os tetos por campo das regras
    // continuam sendo a defesa de fundo. Sem a chave, nada muda.
    //
    // ⚠️ Provedor ENTERPRISE, não o v3: o console só oferece o Fraud Defense, e
    // a 1ª tentativa (ReCaptchaV3Provider + chave clássica, 14/10) dava 400 na
    // troca do token — e, junto com a subida do SDK, derrubou o login de todos
    // por um dia. Qualquer mudança aqui: testar o LOGIN num preview antes.
    const chaveRecaptcha = String((import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || '').trim();
    if (chaveRecaptcha) {
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(chaveRecaptcha), isTokenAutoRefreshEnabled: true });
    }
    
    // Check if a custom database ID is configured, otherwise use default
    //
    // Cache PERSISTENTE (IndexedDB, 16/10/2026): um F5 ou reabrir o app em até
    // ~30 min retoma as escutas e o servidor cobra só o que mudou — antes,
    // cada abertura relia tudo. Várias abas dividem o mesmo cache. Como ele
    // guarda dado pessoal em disco, é apagado ao Sair e quando outra pessoa
    // entra no mesmo navegador (limparDadosDoNavegador, App.tsx).
    const idDoBanco = finalFirebaseConfig.firestoreDatabaseId || '(default)';
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, idDoBanco);
    } catch {
      // Já inicializado (recarga do Vite em desenvolvimento): usa o que existe.
      db = getFirestore(app, idDoBanco);
    }
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    isFirebaseEnabled = true;

    // Validate the connection safely without blocking boot
    const testConnection = async () => {
      try {
        // 'sedes' tem leitura pública nas regras; ler um doc inexistente ali
        // só testa a conectividade. (Antes era 'test/connection' — coleção sem
        // regra nenhuma, então TODO boot disparava um permission-denied inútil.)
        await getDocFromServer(doc(db, 'sedes', '__ping__'));
      } catch (error: any) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Firebase client appears to be offline.");
        }
      }
    };
    testConnection();
  } catch (err) {
    console.error("Erro ao inicializar Firebase:", err);
    isFirebaseEnabled = false;
  }
} else {
  console.log("Firebase não configurado ou em branco. Rodando em Modo de Demonstração Local.");
}

// Error handlers as required by firebase-integration guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Fluent helper functions for CRUD operations (supports local database fallback seamlessly!)
export {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  doc,
  setDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  orderBy,
  limit
};

/**
 * De quem é o cache deste navegador (uid). O cache do Firestore NÃO passa
 * pelas regras do banco: se outra pessoa entra no mesmo navegador sem a
 * anterior ter saído, as consultas dela poderiam mostrar, por um instante,
 * documentos que ficaram do outro usuário. Por isso o App confere o dono no
 * login e limpa tudo quando muda.
 */
const DONO_DO_CACHE = 'sgcp_cache_dono';
export const donoDoCache = (): string | null => { try { return localStorage.getItem(DONO_DO_CACHE); } catch { return null; } };
export const registrarDonoDoCache = (uid: string) => { try { localStorage.setItem(DONO_DO_CACHE, uid); } catch { /* aba privada */ } };

/**
 * Apaga do navegador o que o app guardou de dados (16/10/2026): o cache do
 * Firestore (IndexedDB) e as cópias de coleções no localStorage
 * (`*_fallback`). Depois disso o banco fica encerrado — quem chama recarrega
 * a página. Com outra aba do sistema aberta, o IndexedDB não pode ser
 * apagado (o navegador não deixa); nesse caso devolve false.
 */
export async function limparDadosDoNavegador(): Promise<boolean> {
  try {
    for (const k of Object.keys(localStorage)) if (k.endsWith('_fallback')) localStorage.removeItem(k);
  } catch { /* aba privada */ }
  const esquecerDono = () => { try { localStorage.removeItem(DONO_DO_CACHE); } catch { /* aba privada */ } };
  if (!isFirebaseEnabled || !db) { esquecerDono(); return true; }
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
    // ⚠️ O dono só sai DEPOIS de o cache sair: apagado antes, uma limpeza que
    // falhasse (outra aba aberta) deixava o próximo a entrar herdar o cache
    // sem ninguém notar (revisão de segurança, 16/10/2026).
    esquecerDono();
    return true;
  } catch (e) {
    console.warn('Não foi possível apagar o cache local (outra aba aberta?):', e);
    return false;
  }
}
