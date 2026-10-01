// Firebase initialization — only runs when real config is present.
// In demo mode this module exports a null `services` object and every data
// call in the app must fall back to the local demo store (see lib/demo.ts).

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { resolveFirebaseConfig } from './config';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const cfg = resolveFirebaseConfig();

let services: FirebaseServices | null = null;
if (cfg) {
  try {
    const app = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    services = {
      app,
      auth: getAuth(app),
      db: cfg.firestoreDatabaseId ? getFirestore(app, cfg.firestoreDatabaseId) : getFirestore(app),
    };
  } catch (err) {
    console.error('Firebase init failed, falling back to demo mode:', err);
    services = null;
  }
}

export { services };

// Firestore paths used everywhere (single source of truth).
export const APP_ID = 'monaco-trading-ecosystem';
export const paths = {
  users: ['artifacts', APP_ID, 'public', 'data', 'users'] as const,
  strategies: ['artifacts', APP_ID, 'public', 'data', 'global_strategies'] as const,
  paymentVerifications: ['artifacts', APP_ID, 'public', 'data', 'payment_verifications'] as const,
};
