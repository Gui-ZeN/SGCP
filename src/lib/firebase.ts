/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User, signOut } from 'firebase/auth';
import { 
  getFirestore, 
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
  setDoc
} from 'firebase/firestore';
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

// Robust check to see if Firebase was fully configured
if (finalFirebaseConfig.projectId && finalFirebaseConfig.apiKey) {
  try {
    const app = getApps().length === 0 ? initializeApp(finalFirebaseConfig) : getApp();
    
    // Check if a custom database ID is configured, otherwise use default
    db = getFirestore(app, finalFirebaseConfig.firestoreDatabaseId || '(default)');
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    isFirebaseEnabled = true;

    // Validate the connection safely without blocking boot
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
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
  setDoc
};
