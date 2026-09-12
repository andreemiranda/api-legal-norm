// Configuration and initialization of Firebase instances
// Supports primary instance (Project 1) and mirror instance (Project 2) for traffic rotation

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";

export interface FirebaseInstanceConfig {
  apiKey?: string;
  authDomain?: string;
  databaseURL?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

// Read helper with multi-prefix fallback (NEXT_PUBLIC_ or VITE_)
function getEnv(key: string, backupKey?: string): string {
  try {
    const meta = (import.meta as any).env || {};
    if (meta[key]) return meta[key];
    if (backupKey && meta[backupKey]) return meta[backupKey];
  } catch {}
  return "";
}

// 1. Primary Firebase Project Config
export const primaryConfig: FirebaseInstanceConfig = {
  apiKey: getEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"),
  databaseURL: getEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "VITE_FIREBASE_DATABASE_URL"),
  projectId: getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID"),
};

// 2. Secondary / Mirror Firebase Project Config (for 10GB quota rotation)
export const mirrorConfig: FirebaseInstanceConfig = {
  apiKey: getEnv("NEXT_PUBLIC_FIREBASE_2_API_KEY", "VITE_FIREBASE_2_API_KEY"),
  authDomain: getEnv("NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN", "VITE_FIREBASE_2_AUTH_DOMAIN"),
  databaseURL: getEnv("NEXT_PUBLIC_FIREBASE_2_DATABASE_URL", "VITE_FIREBASE_2_DATABASE_URL"),
  projectId: getEnv("NEXT_PUBLIC_FIREBASE_2_PROJECT_ID", "VITE_FIREBASE_2_PROJECT_ID"),
  storageBucket: getEnv("NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET", "VITE_FIREBASE_2_STORAGE_BUCKET"),
  messagingSenderId: getEnv("NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID", "VITE_FIREBASE_2_MESSAGING_SENDER_ID"),
  appId: getEnv("NEXT_PUBLIC_FIREBASE_2_APP_ID", "VITE_FIREBASE_2_APP_ID"),
};

export function isConfigValid(cfg: FirebaseInstanceConfig): boolean {
  return Boolean(cfg && cfg.apiKey && cfg.databaseURL);
}

// Singleton instances
let primaryAppInstance: FirebaseApp | null = null;
let primaryDbInstance: Database | null = null;
let primaryAuthInstance: Auth | null = null;

let mirrorAppInstance: FirebaseApp | null = null;
let mirrorDbInstance: Database | null = null;

// Lazy initialize Primary Firebase
export function getPrimaryFirebase(): {
  app: FirebaseApp | null;
  db: Database | null;
  auth: Auth | null;
  isValid: boolean;
} {
  if (!isConfigValid(primaryConfig)) {
    return { app: null, db: null, auth: null, isValid: false };
  }

  try {
    if (!primaryAppInstance) {
      const existing = getApps().find((a) => a.name === "[DEFAULT]");
      primaryAppInstance = existing || initializeApp(primaryConfig as any);
      primaryDbInstance = getDatabase(primaryAppInstance);
      primaryAuthInstance = getAuth(primaryAppInstance);
    }
    return {
      app: primaryAppInstance,
      db: primaryDbInstance,
      auth: primaryAuthInstance,
      isValid: true,
    };
  } catch (err) {
    console.warn("Firebase Primary Init Warning:", err);
    return { app: null, db: null, auth: null, isValid: false };
  }
}

// Lazy initialize Mirror Firebase
export function getMirrorFirebase(): {
  app: FirebaseApp | null;
  db: Database | null;
  isValid: boolean;
} {
  if (!isConfigValid(mirrorConfig)) {
    return { app: null, db: null, isValid: false };
  }

  try {
    if (!mirrorAppInstance) {
      const existing = getApps().find((a) => a.name === "firebase_mirror_2");
      mirrorAppInstance = existing || initializeApp(mirrorConfig as any, "firebase_mirror_2");
      mirrorDbInstance = getDatabase(mirrorAppInstance);
    }
    return {
      app: mirrorAppInstance,
      db: mirrorDbInstance,
      isValid: true,
    };
  } catch (err) {
    console.warn("Firebase Mirror Init Warning:", err);
    return { app: null, db: null, isValid: false };
  }
}

// Google Auth Provider setup
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: "select_account",
});
