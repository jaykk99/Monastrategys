// Env-gated Firebase configuration.
// The app must boot keyless: real config comes from VITE_FIREBASE_* env vars.
// The checked-in firebase-applet-config.json is only honored when it holds
// real values (not YOUR_* placeholders). Otherwise the app runs in demo mode.

import appletConfig from '../../firebase-applet-config.json';

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

function isPlaceholder(v: unknown): boolean {
  return typeof v !== 'string' || v.trim() === '' || v.includes('YOUR_');
}

export function resolveFirebaseConfig(): FirebasePublicConfig | null {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  const apiKey = (env.VITE_FIREBASE_API_KEY ?? '').trim();
  if (!isPlaceholder(apiKey)) {
    return {
      apiKey,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: env.VITE_FIREBASE_APP_ID ?? '',
      firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || undefined,
    };
  }
  if (!isPlaceholder(appletConfig.apiKey) && !isPlaceholder(appletConfig.projectId)) {
    return appletConfig as FirebasePublicConfig;
  }
  return null;
}

export function isFirebaseConfigured(): boolean {
  return resolveFirebaseConfig() !== null;
}

// Admin backdoor login exists only when BOTH env vars are set.
export const ADMIN_EMAIL = ((import.meta.env?.VITE_ADMIN_EMAIL ?? '') as string).trim().toLowerCase();
export const ADMIN_PASS = (import.meta.env?.VITE_ADMIN_PASS ?? '') as string;
export const ADMIN_LOGIN_CONFIGURED = ADMIN_EMAIL !== '' && ADMIN_PASS !== '';
