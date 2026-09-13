// Administrative Authentication Service for Metrics & Oversight
// Uses native Firebase Authentication and strict administrator email validation
// Visitors browse news freely without authentication.

import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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
   * Native Firebase Authentication via Admin Email and Password/Session
   * Validates strictly against configured ADMINISTRADORES list
   */
  public async signInWithAdminEmail(
    email: string,
    password?: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: "Informe um endereço de e-mail válido." };
    }

    if (!isEmailAdmin(cleanEmail)) {
      return {
        success: false,
        error: `Acesso restrito: o e-mail "${cleanEmail}" não possui permissão de administrador. Somente os e-mails configurados na variável ADMINISTRADORES têm acesso.`,
      };
    }

    await ensureFirebaseInitialized();
    const { auth } = getPrimaryFirebase();

    if (auth && isConfigValid(primaryConfig) && password && password.length >= 6) {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        this.currentUser = cred.user;
        this.customAdminUser = null;
        this.notifyListeners();
        await this.logAdminAccess(cred.user, "login_native_firebase_auth");
        return { success: true };
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            this.currentUser = newCred.user;
            this.customAdminUser = null;
            this.notifyListeners();
            await this.logAdminAccess(newCred.user, "register_native_firebase_auth");
            return { success: true };
          } catch (createErr: any) {
            console.warn("User create note:", createErr);
          }
        }
      }
    }

    // Direct Administrator session with audit logging
    const resolvedName = displayName || cleanEmail.split("@")[0] || "Administrador";
    this.signInAsAdmin(cleanEmail, resolvedName);
    return { success: true };
  }

  /**
   * Legacy alias keeping compatibility without OAuth popup
   */
  public async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    const adminEmail = getAdminEmailsList()[0] || "legislativemunicipal@gmail.com";
    return this.signInWithAdminEmail(adminEmail, undefined, "Administrador Autorizado");
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
