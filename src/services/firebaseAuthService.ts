// Google & Administrative Authentication Service for Metrics & Oversight
// Note: Visitors browse news freely without authentication.
// Authentication is used exclusively for administrator metrics and session identification.

import { useState, useEffect } from "react";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { ref, set } from "firebase/database";
import {
  getPrimaryFirebase,
  googleAuthProvider,
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

/**
 * Parses and returns the list of configured Google administrator emails.
 * Supports environment variables (ADMINISTRADORES, ADMINITRADORES, VITE_ADMINISTRADORES),
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

  if (!raw || typeof raw !== "string" || !raw.trim()) {
    raw = "legislativemunicipal@gmail.com";
  }

  return raw
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
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
  private customAdminUser: {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  } | null = null;
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
        const saved = localStorage.getItem("nj_admin_session");
        if (saved) {
          this.customAdminUser = JSON.parse(saved);
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
          this.customAdminUser = null;
          try {
            localStorage.removeItem("nj_admin_session");
          } catch {}
          this.logAdminAccess(user);
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
        displayName: this.currentUser.displayName || this.currentUser.email?.split("@")[0] || "Usuário",
        photoURL: this.currentUser.photoURL || null,
      };
    }

    if (this.customAdminUser) {
      const email = this.customAdminUser.email;
      const isAdmin = isEmailAdmin(email);
      return {
        user: null,
        isAuthenticated: true,
        isAdmin,
        email,
        displayName: this.customAdminUser.displayName,
        photoURL: this.customAdminUser.photoURL || null,
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
   * Google Sign-in for admin metrics & authenticated user header display
   */
  public async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    await ensureFirebaseInitialized();
    const { auth } = getPrimaryFirebase();

    if (!auth || !isConfigValid(primaryConfig)) {
      // If Firebase Auth API key is not ready or restricted, provide friendly fallback
      return {
        success: false,
        error: "Serviço Firebase Auth não configurado na origem atual. Utilize a autenticação administrativa direta.",
      };
    }

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      this.currentUser = result.user;
      this.customAdminUser = null;
      this.notifyListeners();
      await this.logAdminAccess(result.user, "login_google");
      return { success: true };
    } catch (err: any) {
      console.warn("Google Sign-in exception:", err);

      // Handle popup blockers or iframe restrictions gracefully
      if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        return {
          success: false,
          error: "O popup de login foi fechado ou bloqueado pelo navegador. Tente novamente ou use a identificação direta.",
        };
      }

      if (err.code === "auth/unauthorized-domain") {
        return {
          success: false,
          error: "O domínio da aplicação precisa ser autorizado no Console do Firebase (Authentication > Settings > Authorized domains).",
        };
      }

      return {
        success: false,
        error: err.message || "Não foi possível concluir o login com Google.",
      };
    }
  }

  /**
   * Direct Administrator login for Norma Jurídica editorial management
   */
  public signInAsAdmin(email?: string, displayName: string = "Editor Chefe"): void {
    const adminEmail = email || getAdminEmailsList()[0] || "legislativemunicipal@gmail.com";
    const adminUser = {
      uid: `admin_${Date.now()}`,
      email: adminEmail,
      displayName,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=1d4ed8&textColor=ffffff`,
    };
    this.customAdminUser = adminUser;
    try {
      localStorage.setItem("nj_admin_session", JSON.stringify(adminUser));
    } catch {}
    this.notifyListeners();
  }

  /**
   * Sign out admin
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
    this.customAdminUser = null;
    try {
      localStorage.removeItem("nj_admin_session");
    } catch {}
    this.notifyListeners();
  }

  /**
   * Records administrative access audit log in Firebase RTDB
   */
  private async logAdminAccess(user: User, eventType: string = "session_active") {
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
      console.warn("Could not log admin audit metric:", e);
    }
  }
}

export const firebaseAuthService = new FirebaseAuthService();

/**
 * React Hook for seamless auth state synchronization across components
 */
export function useFirebaseAuth() {
  const [authState, setAuthState] = useState<AdminUserState>(() => firebaseAuthService.getUserState());

  useEffect(() => {
    const unsubscribe = firebaseAuthService.subscribe((state) => {
      setAuthState(state);
    });
    return () => unsubscribe();
  }, []);

  return authState;
}
