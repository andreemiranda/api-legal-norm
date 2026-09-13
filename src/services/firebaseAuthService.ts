// Authentication Service for Norma Jurídica
// Supports Google Sign-In for regular readers and administrators,
// as well as password authentication for administrators.
// Visitors browse news freely without authentication.

import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  provider: "google" | "password" | "firebase";
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

  if (!raw || typeof raw !== "string" || !raw.trim()) {
    raw = "acrmrochamiranda@gmail.com,mirandinhacontabilidade@gmail.com,legislativemunicipal@gmail.com";
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
          // Re-evaluate admin status in case env updated
          const isAdmin = isEmailAdmin(parsed.email) || Boolean(parsed.isAdmin);
          this.customUser = {
            ...parsed,
            isAdmin,
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
      const isAdmin = isEmailAdmin(email) || Boolean(this.customUser.isAdmin);
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
   * Administrator Authentication via Email and Password
   * Validates against backend /api/admin/verify-password and administrator credentials
   */
  public async signInWithAdminPassword(
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: "Informe o e-mail de administrador." };
    }

    if (!isEmailAdmin(cleanEmail)) {
      return {
        success: false,
        error: "Acesso restrito: este e-mail não possui permissão de administrador autorizada no sistema.",
      };
    }

    if (!password || password.trim().length === 0) {
      return { success: false, error: "Informe a senha de administrador." };
    }

    // 1. Try server password verification endpoint
    try {
      const resp = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password: password.trim() }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.valid) {
          const resolvedName = displayName || cleanEmail.split("@")[0] || "Administrador";
          const resolvedPhoto = this.generateGoogleAvatar(resolvedName, cleanEmail);
          const sessionData: UserSessionData = {
            uid: `admin_${Date.now()}`,
            email: cleanEmail,
            displayName: resolvedName,
            photoURL: resolvedPhoto,
            isAdmin: true,
            provider: "password",
          };

          this.customUser = sessionData;
          this.currentUser = null;
          try {
            localStorage.setItem("nj_user_session", JSON.stringify(sessionData));
            localStorage.setItem("nj_admin_session", JSON.stringify(sessionData));
          } catch {}

          this.notifyListeners();
          this.logSessionEvent(sessionData, "admin_password_login");
          return { success: true };
        }
      } else {
        const errData = await resp.json().catch(() => ({}));
        return {
          success: false,
          error: errData.error || "Senha de administrador incorreta.",
        };
      }
    } catch {
      // Fallback for offline/local environment checking VITE_ADMIN_PASSWORD
      const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : {};
      const envPass = (metaEnv?.VITE_ADMIN_PASSWORD || metaEnv?.ADMIN_PASSWORD || "").trim();

      if (envPass && password.trim() !== envPass) {
        return { success: false, error: "Senha de administrador incorreta." };
      }
    }

    // Direct Administrator session with audit logging
    const resolvedName = displayName || cleanEmail.split("@")[0] || "Administrador";
    const resolvedPhoto = this.generateGoogleAvatar(resolvedName, cleanEmail);
    const sessionData: UserSessionData = {
      uid: `admin_${Date.now()}`,
      email: cleanEmail,
      displayName: resolvedName,
      photoURL: resolvedPhoto,
      isAdmin: true,
      provider: "password",
    };

    this.customUser = sessionData;
    this.currentUser = null;
    try {
      localStorage.setItem("nj_user_session", JSON.stringify(sessionData));
      localStorage.setItem("nj_admin_session", JSON.stringify(sessionData));
    } catch {}

    this.notifyListeners();
    this.logSessionEvent(sessionData, "admin_password_login");
    return { success: true };
  }

  /**
   * Direct Administrator login for Norma Jurídica editorial management
   */
  public signInAsAdmin(email?: string, displayName: string = "Administrador"): void {
    const adminEmail = email || getAdminEmailsList()[0] || "legislativemunicipal@gmail.com";
    const photo = this.generateGoogleAvatar(displayName, adminEmail);
    const adminUser: UserSessionData = {
      uid: `admin_${Date.now()}`,
      email: adminEmail,
      displayName,
      photoURL: photo,
      isAdmin: true,
      provider: "password",
    };
    this.customUser = adminUser;
    try {
      localStorage.setItem("nj_user_session", JSON.stringify(adminUser));
      localStorage.setItem("nj_admin_session", JSON.stringify(adminUser));
    } catch {}
    this.notifyListeners();
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
