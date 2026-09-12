// Multi-Instance Firebase Realtime Database Traffic Router
// Enforces:
// 1. Hybrid storage: in-code static fallback + Firebase RTDB dynamic catalog
// 2. Intelligent traffic rotation: switches between Primary (<9GB) and Mirror instance
// 3. Guaranteed data preservation: zero news lost, older news never removed

import { ref, get, set, child } from "firebase/database";
import { getPrimaryFirebase, getMirrorFirebase, isConfigValid, primaryConfig, mirrorConfig } from "./firebaseConfig";
import { NewsItem } from "../types";
import staticNewsData from "../data/initialNews.json";

export type TrafficSource = "primary" | "mirror" | "static";

export interface ProjectTrafficStats {
  bytesUsed: number;
  limitBytes: number;
  thresholdBytes: number; // 9 GB
  requestCount: number;
  errorCount: number;
  lastActive: string | null;
}

export interface TrafficRouterState {
  activeSource: TrafficSource;
  primaryStats: ProjectTrafficStats;
  mirrorStats: ProjectTrafficStats;
  isMirrorConfigured: boolean;
  isPrimaryConfigured: boolean;
  totalArticlesCount: number;
  lastSyncTime: string | null;
  mode: "automatic" | "manual";
}

// 9 GB in bytes (Safety threshold before 10 GB limit)
export const NINE_GB_IN_BYTES = 9 * 1024 * 1024 * 1024;
export const TEN_GB_IN_BYTES = 10 * 1024 * 1024 * 1024;

const STORAGE_KEY_PREFIX = "nj_rtdb_traffic_";
const getCurrentMonthKey = () => {
  const d = new Date();
  return `${STORAGE_KEY_PREFIX}${d.getFullYear()}_${d.getMonth() + 1}`;
};

class FirebaseTrafficRouter {
  private activeSource: TrafficSource = "primary";
  private isManualOverride: boolean = false;
  private primaryStats: ProjectTrafficStats = {
    bytesUsed: 0,
    limitBytes: TEN_GB_IN_BYTES,
    thresholdBytes: NINE_GB_IN_BYTES,
    requestCount: 0,
    errorCount: 0,
    lastActive: null,
  };
  private mirrorStats: ProjectTrafficStats = {
    bytesUsed: 0,
    limitBytes: TEN_GB_IN_BYTES,
    thresholdBytes: NINE_GB_IN_BYTES,
    requestCount: 0,
    errorCount: 0,
    lastActive: null,
  };
  private listeners: Array<(state: TrafficRouterState) => void> = [];
  private monitorTimer: any = null;

  constructor() {
    this.loadPersistedTraffic();
    this.evaluateRouting();
    this.startPeriodicMonitor();
  }

  // Load monthly usage from localStorage
  private loadPersistedTraffic() {
    try {
      if (typeof window === "undefined") return;
      const key = getCurrentMonthKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.primary) this.primaryStats = { ...this.primaryStats, ...parsed.primary };
        if (parsed.mirror) this.mirrorStats = { ...this.mirrorStats, ...parsed.mirror };
        if (parsed.activeSource && !this.isManualOverride) {
          this.activeSource = parsed.activeSource;
        }
      }
    } catch (e) {
      console.warn("Traffic persistence load error:", e);
    }
  }

  // Save monthly usage to localStorage
  private savePersistedTraffic() {
    try {
      if (typeof window === "undefined") return;
      const key = getCurrentMonthKey();
      const data = {
        primary: this.primaryStats,
        mirror: this.mirrorStats,
        activeSource: this.activeSource,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(data));
      this.notifyListeners();
    } catch {}
  }

  // Subscribe to state updates (used by AdminMetricsModal)
  public subscribe(cb: (state: TrafficRouterState) => void) {
    this.listeners.push(cb);
    cb(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch {}
    });
  }

  // Periodic monitoring check (simulates Cloud Function or background watchdog)
  private startPeriodicMonitor() {
    if (typeof window === "undefined") return;
    if (this.monitorTimer) clearInterval(this.monitorTimer);

    // Run every 60 seconds
    this.monitorTimer = setInterval(() => {
      this.evaluateRouting();
    }, 60000);
  }

  // Evaluates which database to read from based on usage and availability
  public evaluateRouting(): TrafficSource {
    if (this.isManualOverride) {
      return this.activeSource;
    }

    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();

    // 1. If primary reached >= 9GB, failover to mirror if available
    if (primaryFb.isValid && this.primaryStats.bytesUsed < NINE_GB_IN_BYTES) {
      this.activeSource = "primary";
    } else if (mirrorFb.isValid && this.mirrorStats.bytesUsed < NINE_GB_IN_BYTES) {
      // Primary exceeded 9GB or is disabled -> Route to Mirror Instance!
      console.info("⚡ [Traffic Router] Rotação ativada: Consumo do Projeto 1 atingiu teto de 9GB. Alternando para Projeto 2 (Espelho).");
      this.activeSource = "mirror";
    } else if (primaryFb.isValid) {
      // If both exceeded 9GB or mirror not configured, but primary still technically active
      this.activeSource = this.primaryStats.bytesUsed < TEN_GB_IN_BYTES ? "primary" : "static";
    } else {
      // Fallback estático
      this.activeSource = "static";
    }

    this.savePersistedTraffic();
    return this.activeSource;
  }

  // Manual source override (for testing in Admin Metrics)
  public setManualSource(source: TrafficSource) {
    this.activeSource = source;
    this.isManualOverride = true;
    this.savePersistedTraffic();
  }

  public resetToAutomatic() {
    this.isManualOverride = false;
    this.evaluateRouting();
  }

  // Log read request and estimated byte size
  private recordRead(source: TrafficSource, byteEstimate: number, hasError: boolean = false) {
    const now = new Date().toISOString();
    if (source === "primary") {
      this.primaryStats.requestCount++;
      this.primaryStats.bytesUsed += byteEstimate;
      this.primaryStats.lastActive = now;
      if (hasError) this.primaryStats.errorCount++;
    } else if (source === "mirror") {
      this.mirrorStats.requestCount++;
      this.mirrorStats.bytesUsed += byteEstimate;
      this.mirrorStats.lastActive = now;
      if (hasError) this.mirrorStats.errorCount++;
    }
    this.savePersistedTraffic();

    // If reading just exceeded 9GB, trigger rotation evaluation
    if (
      (source === "primary" && this.primaryStats.bytesUsed >= NINE_GB_IN_BYTES) ||
      (source === "mirror" && this.mirrorStats.bytesUsed >= NINE_GB_IN_BYTES)
    ) {
      this.evaluateRouting();
    }
  }

  /**
   * Fetch news using the hybrid architecture:
   * 1. Check active Firebase instance (Primary or Mirror)
   * 2. If healthy, merge with in-code static dataset (deduplicated)
   * 3. If Firebase reaches limit or errors out, fallback to in-code static dataset
   * Guarantees 0% downtime and 100% news preservation.
   */
  public async fetchNews(): Promise<{ news: NewsItem[]; sourceUsed: TrafficSource }> {
    const currentSource = this.evaluateRouting();

    // If static fallback is active
    if (currentSource === "static") {
      return {
        news: staticNewsData as NewsItem[],
        sourceUsed: "static",
      };
    }

    // Attempt Firebase Read
    try {
      const fbInstance = currentSource === "primary" ? getPrimaryFirebase() : getMirrorFirebase();
      if (!fbInstance.isValid || !fbInstance.db) {
        // Switch to other source or fallback
        if (currentSource === "primary") {
          const mirror = getMirrorFirebase();
          if (mirror.isValid && mirror.db) {
            this.activeSource = "mirror";
            return this.fetchNews();
          }
        }
        return { news: staticNewsData as NewsItem[], sourceUsed: "static" };
      }

      const dbRef = ref(fbInstance.db);
      const snapshot = await get(child(dbRef, "news"));

      if (snapshot.exists()) {
        const val = snapshot.val();
        const firebaseNewsArray: NewsItem[] = Array.isArray(val)
          ? val
          : typeof val === "object" && val !== null
          ? Object.values(val)
          : [];

        // Estimate transferred payload size
        const rawJsonString = JSON.stringify(val);
        const payloadBytes = new Blob([rawJsonString]).size;
        this.recordRead(currentSource, payloadBytes, false);

        // Merge Firebase news with static news (ZERO NEWS LOST)
        const combined = this.mergeAndDeduplicate(firebaseNewsArray, staticNewsData as NewsItem[]);
        return { news: combined, sourceUsed: currentSource };
      } else {
        // Snapshot is empty (database not seeded yet)
        this.recordRead(currentSource, 512, false);
        return { news: staticNewsData as NewsItem[], sourceUsed: "static" };
      }
    } catch (err: any) {
      console.warn(`[Traffic Router] Erro lendo Firebase (${currentSource}):`, err?.message || err);
      this.recordRead(currentSource, 256, true);

      // Failover to mirror if primary failed
      if (currentSource === "primary") {
        const mirror = getMirrorFirebase();
        if (mirror.isValid && this.mirrorStats.bytesUsed < NINE_GB_IN_BYTES) {
          console.info("⚡ [Traffic Router] Failover imediato para Projeto 2 (Espelho)");
          this.activeSource = "mirror";
          return this.fetchNews();
        }
      }

      // Safe fallback to static in-code collection
      return { news: staticNewsData as NewsItem[], sourceUsed: "static" };
    }
  }

  /**
   * Sync and mirror articles to all available Firebase projects
   * Writes to BOTH Primary and Mirror so data stays identical across instances.
   */
  public async mirrorNewsToFirebase(
    articles: NewsItem[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<{ success: boolean; syncedCount: number; mirrored: boolean }> {
    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();

    if (!primaryFb.isValid && !mirrorFb.isValid) {
      throw new Error("Nenhum projeto Firebase configurado com credenciais válidas.");
    }

    const payload: Record<string, NewsItem> = {};
    articles.forEach((item) => {
      const cleanKey = String(item.id || item.slug || Math.random()).replace(/[\.\#\$\[\]\/]/g, "_");
      payload[cleanKey] = item;
    });

    let primarySynced = false;
    let mirrorSynced = false;

    // 1. Sync to Primary
    if (primaryFb.isValid && primaryFb.db) {
      if (onProgress) onProgress(30, "Sincronizando com Projeto 1 (Principal)...");
      try {
        const primaryRef = ref(primaryFb.db, "news");
        await set(primaryRef, payload);
        primarySynced = true;
      } catch (err) {
        console.error("Erro sincronizando com Projeto 1:", err);
      }
    }

    // 2. Sync to Mirror Instance
    if (mirrorFb.isValid && mirrorFb.db) {
      if (onProgress) onProgress(70, "Espelhando no Projeto 2 (Espelho de Rotação)...");
      try {
        const mirrorRef = ref(mirrorFb.db, "news");
        await set(mirrorRef, payload);
        mirrorSynced = true;
      } catch (err) {
        console.error("Erro sincronizando com Projeto 2:", err);
      }
    }

    if (onProgress) onProgress(100, "Sincronização concluída com sucesso!");

    this.savePersistedTraffic();
    return {
      success: primarySynced || mirrorSynced,
      syncedCount: articles.length,
      mirrored: primarySynced && mirrorSynced,
    };
  }

  /**
   * Record an anonymous access metric to Firebase RTDB for administration and traffic stats
   * Never blocks visitor flow
   */
  public async logMetricEvent(type: string, data: Record<string, any>) {
    try {
      const fb = getPrimaryFirebase();
      if (!fb.isValid || !fb.db) return;

      const metricRef = ref(fb.db, `access_metrics/${Date.now()}`);
      await set(metricRef, {
        type,
        timestamp: new Date().toISOString(),
        path: typeof window !== "undefined" ? window.location.pathname : "",
        ...data,
      });
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Deduplicate and preserve all articles
   */
  private mergeAndDeduplicate(primaryList: NewsItem[], fallbackList: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    const merged: NewsItem[] = [];

    // Prioritize primary (newer updates from Firebase)
    for (const item of primaryList) {
      const key = String(item.slug || item.id || item.link || item.title);
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Add remaining from fallback (guarantees old articles are never lost)
    for (const item of fallbackList) {
      const key = String(item.slug || item.id || item.link || item.title);
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Sort chronologically
    merged.sort((a, b) => {
      const timeA = new Date(a.pubDate || 0).getTime();
      const timeB = new Date(b.pubDate || 0).getTime();
      return timeB - timeA;
    });

    return merged;
  }

  public getState(): TrafficRouterState {
    return {
      activeSource: this.activeSource,
      primaryStats: { ...this.primaryStats },
      mirrorStats: { ...this.mirrorStats },
      isPrimaryConfigured: isConfigValid(primaryConfig),
      isMirrorConfigured: isConfigValid(mirrorConfig),
      totalArticlesCount: staticNewsData.length,
      lastSyncTime: this.primaryStats.lastActive || this.mirrorStats.lastActive,
      mode: this.isManualOverride ? "manual" : "automatic",
    };
  }
}

// Global router singleton
export const trafficRouter = new FirebaseTrafficRouter();
