// Google Authentication Service for Administration & Access Metrics
// Note: This authentication is solely for metrics and administrative oversight.
// Regular visitors are never prompted to sign in and read all content freely.

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { ref, set } from "firebase/database";
import { getPrimaryFirebase, googleAuthProvider } from "./firebaseConfig";

export interface AdminUserState {
  user: User | null;
  isAdmin: boolean;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

class FirebaseAuthService {
  private currentUser: User | null = null;
  private listeners: Array<(state: AdminUserState) => void> = [];

  constructor() {
    this.initAuthListener();
  }

  private initAuthListener() {
    const { auth } = getPrimaryFirebase();
    if (!auth) return;

    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.notifyListeners();

      if (user) {
        this.logAdminAccess(user);
      }
    });
  }

  private notifyListeners() {
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
    return {
      user: this.currentUser,
      isAdmin: Boolean(this.currentUser),
      email: this.currentUser?.email || null,
      displayName: this.currentUser?.displayName || null,
      photoURL: this.currentUser?.photoURL || null,
    };
  }

  /**
   * Non-intrusive Google Sign-in for admin metrics
   */
  public async signInWithGoogle(): Promise<User> {
    const { auth } = getPrimaryFirebase();
    if (!auth) {
      throw new Error("Firebase Auth não está configurado. Preencha NEXT_PUBLIC_FIREBASE_API_KEY no arquivo .env.");
    }

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      this.currentUser = result.user;
      await this.logAdminAccess(result.user, "login");
      return result.user;
    } catch (err: any) {
      console.error("Erro no login com Google:", err);
      throw err;
    }
  }

  /**
   * Sign out admin
   */
  public async signOut(): Promise<void> {
    const { auth } = getPrimaryFirebase();
    if (auth) {
      await signOut(auth);
    }
    this.currentUser = null;
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
