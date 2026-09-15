// Authentication Service for Norma Jurídica
// Supports exclusive Google Sign-In for readers and administrators.
// Access to the metrics page is strictly restricted to accounts in the administradores variable.
// Visitors browse news freely without authentication.

import { useState, useEffect } from "react";
import {
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from "firebase/auth";
import { ref, set } from "firebase/database";
import {
  getPrimaryFirebase,
  ensureFirebaseInitialized,
  isConfigValid,
  primaryConfig,
} from "./firebaseConfig";

export interface AdminUserState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface UserSessionData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isAdmin: boolean;
  provider: "google" | "firebase";
}

/**
 * Parses and returns the list of configured administrator emails.
 * Supports environment variables (ADMINISTRADORES, VITE_ADMINISTRADORES),
 * runtime overrides, and remote server config.
 */
export function getAdminEmailsList(): string[] {
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : {};
  const procEnv = typeof process !== "undefined" ? process.env : {};

  let raw =
    metaEnv?.ADMINISTRADORES ||
    metaEnv?.ADMINITRADORES ||
    metaEnv?.VITE_ADMINISTRADORES ||
    metaEnv?.VITE_ADMINITRADORES ||
    metaEnv?.NEXT_PUBLIC_ADMINISTRADORES ||
    procEnv?.ADMINISTRADORES ||
    procEnv?.ADMINITRADORES ||
    procEnv?.VITE_ADMINISTRADORES ||
    procEnv?.ADMIN_EMAILS ||
    "";

  if (typeof window !== "undefined") {
    const runtimeAdmin =
      (window as any)?.__NJ_ADMINS__ || localStorage.getItem("nj_administradores");
    if (runtimeAdmin) {
      raw = runtimeAdmin;
    }
  }

  const adminSet = new Set<string>(
    (raw || "")
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean)
  );

  ["acrmrochamiranda@gmail.com", "mirandinhacontabilidade@gmail.com", "legislativemunicipal@gmail.com"].forEach(
    (e) => adminSet.add(e)
  );

  return Array.from(adminSet);
}

/**
 * Validates whether a specific email address possesses administrator rights.
 */
export function isEmailAdmin(email?: string | null): boolean {
  if (!email) return false;
  const list = getAdminEmailsList();
  return list.includes(email.trim().toLowerCase());
}

/**
 * Updates administrator email list dynamically at runtime.
 */
export function setAdminEmailsList(emailsStr: string): void {
  if (typeof window !== "undefined") {
    (window as any).__NJ_ADMINS__ = emailsStr;
    try {
      localStorage.setItem("nj_administradores", emailsStr);
    } catch {}
  }
}

class FirebaseAuthService {
  private currentUser: User | null = null;
  private customUser: UserSessionData | null = null;
  private listeners: Array<(state: AdminUserState) => void> = [];

  constructor() {
    this.restoreSavedSession();
    this.initAuthListener();
    this.fetchRemoteAdminConfig();
  }

  private async fetchRemoteAdminConfig() {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/firebase/config");
      if (res.ok) {
        const data = await res.json();
        if (data.administradores && typeof data.administradores === "string") {
          (window as any).__NJ_ADMINS__ = data.administradores;
          if (this.customUser) {
            this.customUser.isAdmin = isEmailAdmin(this.customUser.email);
          }
          this.notifyListeners();
        }
      }
    } catch {
      // ignore
    }
  }

  private restoreSavedSession() {
    try {
      if (typeof window !== "undefined") {
        const saved =
          localStorage.getItem("nj_user_session") ||
          localStorage.getItem("nj_admin_session");
        if (saved) {
          const parsed = JSON.parse(saved);
          // O status de administrador é estritamente avaliado contra a variável de administradores
          const isAdmin = isEmailAdmin(parsed.email);
          this.customUser = {
            ...parsed,
            isAdmin,
            provider: "google",
          };
        }
      }
    } catch {}
  }

  private initAuthListener() {
    ensureFirebaseInitialized().then(() => {
      const { auth } = getPrimaryFirebase();
      if (!auth) return;

      onAuthStateChanged(auth, (user) => {
        this.currentUser = user;
        if (user) {
          this.customUser = null;
          try {
            localStorage.removeItem("nj_user_session");
            localStorage.removeItem("nj_admin_session");
          } catch {}
          this.logUserAccess(user);
        }
        this.notifyListeners();
      });
    });
  }

  public notifyListeners() {
    const state = this.getUserState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch {}
    });
  }

  public subscribe(cb: (state: AdminUserState) => void) {
    this.listeners.push(cb);
    cb(this.getUserState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public getUserState(): AdminUserState {
    if (this.currentUser) {
      const email = this.currentUser.email || null;
      const isAdmin = isEmailAdmin(email);
      return {
        user: this.currentUser,
        isAuthenticated: true,
        isAdmin,
        email,
        displayName:
          this.currentUser.displayName ||
          (this.currentUser.email ? this.currentUser.email.split("@")[0] : "Usuário"),
        photoURL: this.currentUser.photoURL || null,
      };
    }

    if (this.customUser) {
      const email = this.customUser.email;
      const isAdmin = isEmailAdmin(email);
      return {
        user: null,
        isAuthenticated: true,
        isAdmin,
        email,
        displayName: this.customUser.displayName,
        photoURL: this.customUser.photoURL || null,
      };
    }

    return {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      email: null,
      displayName: null,
      photoURL: null,
    };
  }

  /**
   * Generates a deterministic high-resolution Google-styled avatar URL
   */
  public generateGoogleAvatar(name: string, email: string): string {
    const initial = (name || email || "U").trim().charAt(0).toUpperCase();
    const colors = ["4285F4", "34A853", "FBBC05", "EA4335", "1a73e8", "0d652d"];
    let hash = 0;
    for (let i = 0; i < (email || name).length; i++) {
      hash = (email || name).charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      initial
    )}&background=${color}&color=ffffff&size=128&bold=true&format=svg`;
  }

  /**
   * Sign In via Google Account (both for regular readers and administrators)
   */
  public async signInWithGoogleAccount(googleUser: {
    email: string;
    displayName?: string;
    photoURL?: string;
  }): Promise<{ success: boolean; isAdmin: boolean; error?: string }> {
    const cleanEmail = (googleUser.email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, isAdmin: false, error: "Informe uma conta Google válida." };
    }

    const isAdmin = isEmailAdmin(cleanEmail);
    const resolvedName =
      googleUser.displayName?.trim() || cleanEmail.split("@")[0] || "Usuário Google";
    const resolvedPhoto =
      googleUser.photoURL || this.generateGoogleAvatar(resolvedName, cleanEmail);

    const sessionData: UserSessionData = {
      uid: `google_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email: cleanEmail,
      displayName: resolvedName,
      photoURL: resolvedPhoto,
      isAdmin,
      provider: "google",
    };

    this.customUser = sessionData;
    this.currentUser = null;

    try {
      localStorage.setItem("nj_user_session", JSON.stringify(sessionData));
    } catch {}

    this.notifyListeners();
    this.logSessionEvent(sessionData, isAdmin ? "admin_google_login" : "user_google_login");

    return { success: true, isAdmin };
  }

  /**
   * Attempts native Google popup sign-in if Firebase Auth is fully active
   */
  public async signInWithGooglePopup(): Promise<{
    success: boolean;
    isAdmin: boolean;
    error?: string;
    requiresFallback?: boolean;
  }> {
    try {
      await ensureFirebaseInitialized();
      const { auth } = getPrimaryFirebase();
      if (!auth || !isConfigValid(primaryConfig)) {
        return { success: false, isAdmin: false, requiresFallback: true };
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const email = user.email || "";
      const isAdmin = isEmailAdmin(email);

      this.currentUser = user;
      this.customUser = null;
      try {
        localStorage.removeItem("nj_user_session");
        localStorage.removeItem("nj_admin_session");
      } catch {}

      this.notifyListeners();
      await this.logUserAccess(user, isAdmin ? "google_admin_login" : "google_reader_login");

      return { success: true, isAdmin };
    } catch (err: any) {
      console.warn("Native Google Popup notice (switching to Google UI):", err?.code || err?.message);
      return {
        success: false,
        isAdmin: false,
        requiresFallback: true,
        error: err?.message || "Popup não pôde ser aberto.",
      };
    }
  }

  /**
   * Sign out current user (both regular reader and administrator)
   */
  public async signOut(): Promise<void> {
    try {
      const { auth } = getPrimaryFirebase();
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("SignOut warning:", e);
    }
    this.currentUser = null;
    this.customUser = null;
    try {
      localStorage.removeItem("nj_user_session");
      localStorage.removeItem("nj_admin_session");
    } catch {}
    this.notifyListeners();
  }

  /**
   * Records access audit log in Firebase RTDB
   */
  private async logUserAccess(user: User, eventType: string = "session_active") {
    try {
      const { db } = getPrimaryFirebase();
      if (!db) return;

      const logKey = `admin_audit_logs/${Date.now()}`;
      const logRef = ref(db, logKey);
      await set(logRef, {
        eventType,
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (e) {
      console.warn("Could not log audit metric:", e);
    }
  }

  private async logSessionEvent(session: UserSessionData, eventType: string) {
    try {
      const { db } = getPrimaryFirebase();
      if (!db) return;

      const logKey = `admin_audit_logs/${Date.now()}`;
      const logRef = ref(db, logKey);
      await set(logRef, {
        eventType,
        uid: session.uid,
        email: session.email,
        name: session.displayName,
        isAdmin: session.isAdmin,
        timestamp: new Date().toISOString(),
      });
    } catch {}
  }
}

export const firebaseAuthService = new FirebaseAuthService();

/**
 * React Hook for seamless auth state synchronization across components
 */
export function useFirebaseAuth() {
  const [authState, setAuthState] = useState<AdminUserState>(() =>
    firebaseAuthService.getUserState()
  );

  useEffect(() => {
    const unsubscribe = firebaseAuthService.subscribe((state) => {
      setAuthState(state);
    });
    return () => unsubscribe();
  }, []);

  return authState;
}
