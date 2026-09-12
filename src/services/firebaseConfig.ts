// Configuration and initialization of Firebase instances
// Supports primary instance (Project 1) and mirror instance (Project 2) for traffic rotation
// Automatically hydrates from runtime /api/firebase/config in production

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
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

// Check saved custom credentials in localStorage
function getSavedConfig(key: string): FirebaseInstanceConfig | null {
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    }
  } catch {}
  return null;
}

const savedPrimary = getSavedConfig("nj_firebase_primary");
const savedMirror = getSavedConfig("nj_firebase_mirror");

// 1. Primary Firebase Project Config
export const primaryConfig: FirebaseInstanceConfig = {
  apiKey: savedPrimary?.apiKey || getEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"),
  authDomain: savedPrimary?.authDomain || getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"),
  databaseURL: savedPrimary?.databaseURL || getEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "VITE_FIREBASE_DATABASE_URL"),
  projectId: savedPrimary?.projectId || getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"),
  storageBucket: savedPrimary?.storageBucket || getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: savedPrimary?.messagingSenderId || getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: savedPrimary?.appId || getEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID"),
};

// 2. Secondary / Mirror Firebase Project Config (for 10GB quota rotation)
export const mirrorConfig: FirebaseInstanceConfig = {
  apiKey: savedMirror?.apiKey || getEnv("NEXT_PUBLIC_FIREBASE_2_API_KEY", "VITE_FIREBASE_2_API_KEY"),
  authDomain: savedMirror?.authDomain || getEnv("NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN", "VITE_FIREBASE_2_AUTH_DOMAIN"),
  databaseURL: savedMirror?.databaseURL || getEnv("NEXT_PUBLIC_FIREBASE_2_DATABASE_URL", "VITE_FIREBASE_2_DATABASE_URL"),
  projectId: savedMirror?.projectId || getEnv("NEXT_PUBLIC_FIREBASE_2_PROJECT_ID", "VITE_FIREBASE_2_PROJECT_ID"),
  storageBucket: savedMirror?.storageBucket || getEnv("NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET", "VITE_FIREBASE_2_STORAGE_BUCKET"),
  messagingSenderId: savedMirror?.messagingSenderId || getEnv("NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID", "VITE_FIREBASE_2_MESSAGING_SENDER_ID"),
  appId: savedMirror?.appId || getEnv("NEXT_PUBLIC_FIREBASE_2_APP_ID", "VITE_FIREBASE_2_APP_ID"),
};

export function isConfigValid(cfg: FirebaseInstanceConfig): boolean {
  return Boolean(cfg && cfg.apiKey && (cfg.databaseURL || cfg.projectId));
}

// Singleton instances
let primaryAppInstance: FirebaseApp | null = null;
let primaryDbInstance: Database | null = null;
let primaryAuthInstance: Auth | null = null;

let mirrorAppInstance: FirebaseApp | null = null;
let mirrorDbInstance: Database | null = null;

// Listeners when config is hydrated
const configListeners: Array<() => void> = [];

export function onFirebaseConfigReady(cb: () => void) {
  configListeners.push(cb);
  if (isConfigValid(primaryConfig)) {
    cb();
  }
}

// Asynchronously fetch runtime config from server if missing in client build
let initPromise: Promise<boolean> | null = null;

export async function ensureFirebaseInitialized(): Promise<boolean> {
  if (isConfigValid(primaryConfig)) {
    getPrimaryFirebase();
    return true;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch("/api/firebase/config");
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          if (json.primary && json.primary.apiKey) {
            Object.assign(primaryConfig, json.primary);
          }
          if (json.mirror && json.mirror.apiKey) {
            Object.assign(mirrorConfig, json.mirror);
          }
          // Re-initialize
          getPrimaryFirebase();
          if (isConfigValid(mirrorConfig)) {
            getMirrorFirebase();
          }
          configListeners.forEach((l) => {
            try {
              l();
            } catch {}
          });
          return isConfigValid(primaryConfig);
        }
      }
    } catch (err) {
      console.warn("Could not fetch /api/firebase/config:", err);
    }
    return isConfigValid(primaryConfig);
  })();

  return initPromise;
}

// Auto-run runtime fetch in browser
if (typeof window !== "undefined") {
  ensureFirebaseInitialized();
}

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
    }
    if (!primaryDbInstance && primaryAppInstance && primaryConfig.databaseURL) {
      try {
        primaryDbInstance = getDatabase(primaryAppInstance);
      } catch (e) {
        console.warn("RTDB Primary connect note:", e);
      }
    }
    if (!primaryAuthInstance && primaryAppInstance) {
      try {
        primaryAuthInstance = getAuth(primaryAppInstance);
      } catch (e) {
        console.warn("Auth Primary connect note:", e);
      }
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
    }
    if (!mirrorDbInstance && mirrorAppInstance && mirrorConfig.databaseURL) {
      try {
        mirrorDbInstance = getDatabase(mirrorAppInstance);
      } catch (e) {
        console.warn("RTDB Mirror connect note:", e);
      }
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
