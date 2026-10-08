import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Slide, Template, GlobalSettings } from './types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore using the specific provisioned databaseId
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const SIGNAGE_DOC_ID = 'default_screen';
const signageDocRef = doc(db, 'signage', SIGNAGE_DOC_ID);

export interface SyncData {
  slides: Slide[];
  templates: Template[];
  settings: GlobalSettings;
  categories: string[];
  updatedAt?: string;
  deviceSource?: string;
}

/**
 * Validates connection to Firestore backend as per Firebase guidelines
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'signage', 'health_check'));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('Firestore client is currently offline or unreachable.');
      return false;
    }
    // Document might not exist yet, which is expected and means connection is active
    return true;
  }
}

/**
 * Listen in real time to cloud changes from Firestore.
 * When changes are saved from the PC, the TV automatically receives them instantly!
 */
export function subscribeToSignageCloud(
  onData: (data: SyncData) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    signageDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SyncData;
        onData(data);
      }
    },
    (error) => {
      console.error('Error al escuchar sincronización en la nube:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Saves the current state (slides, templates, settings, categories) to Firestore.
 */
export async function saveSignageToCloud(data: SyncData): Promise<void> {
  try {
    const payload: SyncData = {
      slides: data.slides,
      templates: data.templates,
      settings: data.settings,
      categories: data.categories,
      updatedAt: new Date().toISOString(),
      deviceSource: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'PC / Editor',
    };
    await setDoc(signageDocRef, payload, { merge: true });
  } catch (err) {
    console.error('Error guardando en Firestore:', err);
    throw err;
  }
}

/**
 * Fetch initial cloud data if available
 */
export async function loadSignageFromCloud(): Promise<SyncData | null> {
  try {
    const snap = await getDoc(signageDocRef);
    if (snap.exists()) {
      return snap.data() as SyncData;
    }
    return null;
  } catch (err) {
    console.warn('No se pudo cargar desde Firestore inicial, usando caché:', err);
    return null;
  }
}
