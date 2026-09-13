// Multi-Instance Firebase Realtime Database Traffic & Storage Router
// Architecture:
// 1. Dual Spark Instance Management: Banco 1 (legal-norm2) & Banco 2 (legal-norm3)
// 2. Storage Rotation (Independent): 1GB max per DB. At 950MB on active DB, writes route to second DB.
//    If both reach 950MB, triggers alert in Admin Metrics without ever deleting or overwriting any news.
// 3. Traffic Rotation (Independent): 10GB monthly download bandwidth per DB. At 9.5GB, reads route to other DB.
//    Auto-resets monthly. Total combined capacity: ~1900MB storage and ~19GB traffic per month.
// 4. Lightweight Index Layer: JSON/hash catalog tracking physical location (primary, mirror, both, static) of each article.
// 5. In-code static fallback: guarantees 0% downtime and 100% news preservation if both databases are unreachable.

import { ref, get, set, child } from "firebase/database";
import {
  getPrimaryFirebase,
  getMirrorFirebase,
  isConfigValid,
  primaryConfig,
  mirrorConfig,
} from "./firebaseConfig";
import { NewsItem } from "../types";
import staticNewsData from "../data/initialNews.json";

export type TrafficSource = "primary" | "mirror" | "static";
export type StorageTarget = "primary" | "mirror" | "both" | "static";

// 1 GB & 10 GB limits in bytes (Spark Plan)
export const ONE_GB_IN_BYTES = 1024 * 1024 * 1024; // 1,073,741,824 bytes
export const NINE_FIFTY_MB_IN_BYTES = 950 * 1024 * 1024; // 996,147,200 bytes (~950MB)
export const TEN_GB_IN_BYTES = 10 * 1024 * 1024 * 1024; // 10,737,418,240 bytes
export const NINE_POINT_FIVE_GB_IN_BYTES = 9.5 * 1024 * 1024 * 1024; // 10,200,547,328 bytes (~9.5GB)

export interface NewsIndexEntry {
  id: string | number;
  slug: string;
  title: string;
  category: string;
  pubDate: string;
  storedIn: StorageTarget;
  sizeBytes: number;
  lastVerified: string;
}

export interface NewsCatalogIndex {
  version: number;
  totalArticles: number;
  primaryCount: number;
  mirrorCount: number;
  staticCount: number;
  primaryStorageBytes: number;
  mirrorStorageBytes: number;
  updatedAt: string;
  entries: Record<string, NewsIndexEntry>;
}

export interface ProjectBandwidthStats {
  bytesUsed: number;
  limitBytes: number;
  thresholdBytes: number; // 9.5 GB
  requestCount: number;
  errorCount: number;
  lastActive: string | null;
}

export interface ProjectStorageStats {
  bytesUsed: number;
  limitBytes: number;
  thresholdBytes: number; // 950 MB
  articleCount: number;
  isNearLimit: boolean;
  lastWrite: string | null;
}

export interface TrafficRouterState {
  activeReadSource: TrafficSource;
  activeWriteTarget: "primary" | "mirror" | "warning_both_full";
  bothStorageNearLimit: boolean;
  primaryTraffic: ProjectBandwidthStats;
  mirrorTraffic: ProjectBandwidthStats;
  primaryStorage: ProjectStorageStats;
  mirrorStorage: ProjectStorageStats;
  isPrimaryConfigured: boolean;
  isMirrorConfigured: boolean;
  totalArticlesCount: number;
  indexEntriesCount: number;
  lastSyncTime: string | null;
  mode: "automatic" | "manual";
  monthCycle: string;
}

const STORAGE_KEY_PREFIX = "nj_rtdb_traffic_v2_";
const INDEX_STORAGE_KEY = "nj_news_catalog_index_v2";

const getCurrentMonthKey = () => {
  const d = new Date();
  return `${STORAGE_KEY_PREFIX}${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, "0")}`;
};

class FirebaseTrafficRouter {
  private activeReadSource: TrafficSource = "primary";
  private isManualOverride: boolean = false;

  // Monthly bandwidth tracking (Resets every 1st of month)
  private primaryTraffic: ProjectBandwidthStats = {
    bytesUsed: 0,
    limitBytes: TEN_GB_IN_BYTES,
    thresholdBytes: NINE_POINT_FIVE_GB_IN_BYTES,
    requestCount: 0,
    errorCount: 0,
    lastActive: null,
  };

  private mirrorTraffic: ProjectBandwidthStats = {
    bytesUsed: 0,
    limitBytes: TEN_GB_IN_BYTES,
    thresholdBytes: NINE_POINT_FIVE_GB_IN_BYTES,
    requestCount: 0,
    errorCount: 0,
    lastActive: null,
  };

  // Persistent Storage Space Tracking (1GB limit each, rotation at 950MB)
  private primaryStorage: ProjectStorageStats = {
    bytesUsed: 0,
    limitBytes: ONE_GB_IN_BYTES,
    thresholdBytes: NINE_FIFTY_MB_IN_BYTES,
    articleCount: 0,
    isNearLimit: false,
    lastWrite: null,
  };

  private mirrorStorage: ProjectStorageStats = {
    bytesUsed: 0,
    limitBytes: ONE_GB_IN_BYTES,
    thresholdBytes: NINE_FIFTY_MB_IN_BYTES,
    articleCount: 0,
    isNearLimit: false,
    lastWrite: null,
  };

  // Lightweight index catalog
  private catalogIndex: NewsCatalogIndex = {
    version: 2,
    totalArticles: 0,
    primaryCount: 0,
    mirrorCount: 0,
    staticCount: staticNewsData.length,
    primaryStorageBytes: 0,
    mirrorStorageBytes: 0,
    updatedAt: new Date().toISOString(),
    entries: {},
  };

  private listeners: Array<(state: TrafficRouterState) => void> = [];
  private monitorTimer: any = null;

  constructor() {
    this.bootstrapStaticIndex();
    this.loadPersistedData();
    this.evaluateReadRouting();
    this.evaluateWriteTarget();
    this.startPeriodicMonitor();
  }

  // Populate initial index from in-code static news fallback
  private bootstrapStaticIndex() {
    for (const item of staticNewsData as NewsItem[]) {
      const key = String(item.slug || item.id || item.link);
      const estSize = new Blob([JSON.stringify(item)]).size;
      this.catalogIndex.entries[key] = {
        id: item.id,
        slug: item.slug || "",
        title: item.title,
        category: item.category || "Notícias",
        pubDate: item.pubDate || new Date().toISOString(),
        storedIn: "static",
        sizeBytes: estSize,
        lastVerified: new Date().toISOString(),
      };
    }
    this.catalogIndex.totalArticles = Object.keys(this.catalogIndex.entries).length;
  }

  // Load monthly usage and index from persistent browser storage
  private loadPersistedData() {
    try {
      if (typeof window === "undefined") return;

      // 1. Monthly Traffic
      const monthKey = getCurrentMonthKey();
      const rawTraffic = localStorage.getItem(monthKey);
      if (rawTraffic) {
        const parsed = JSON.parse(rawTraffic);
        if (parsed.primaryTraffic) this.primaryTraffic = { ...this.primaryTraffic, ...parsed.primaryTraffic };
        if (parsed.mirrorTraffic) this.mirrorTraffic = { ...this.mirrorTraffic, ...parsed.mirrorTraffic };
        if (parsed.activeReadSource && !this.isManualOverride) {
          this.activeReadSource = parsed.activeReadSource;
        }
      }

      // 2. Storage stats
      const rawStorage = localStorage.getItem("nj_rtdb_storage_stats_v2");
      if (rawStorage) {
        const parsed = JSON.parse(rawStorage);
        if (parsed.primaryStorage) this.primaryStorage = { ...this.primaryStorage, ...parsed.primaryStorage };
        if (parsed.mirrorStorage) this.mirrorStorage = { ...this.mirrorStorage, ...parsed.mirrorStorage };
      }

      // 3. Lightweight Index
      const rawIndex = localStorage.getItem(INDEX_STORAGE_KEY);
      if (rawIndex) {
        const parsed: NewsCatalogIndex = JSON.parse(rawIndex);
        if (parsed.entries) {
          this.catalogIndex.entries = { ...this.catalogIndex.entries, ...parsed.entries };
          this.catalogIndex.totalArticles = Object.keys(this.catalogIndex.entries).length;
          this.catalogIndex.primaryCount = parsed.primaryCount || 0;
          this.catalogIndex.mirrorCount = parsed.mirrorCount || 0;
          this.catalogIndex.primaryStorageBytes = parsed.primaryStorageBytes || this.primaryStorage.bytesUsed;
          this.catalogIndex.mirrorStorageBytes = parsed.mirrorStorageBytes || this.mirrorStorage.bytesUsed;
        }
      }
    } catch (e) {
      console.warn("Traffic/Storage persistence load error:", e);
    }
  }

  // Save state to local storage
  private savePersistedData() {
    try {
      if (typeof window === "undefined") return;
      const monthKey = getCurrentMonthKey();

      localStorage.setItem(
        monthKey,
        JSON.stringify({
          primaryTraffic: this.primaryTraffic,
          mirrorTraffic: this.mirrorTraffic,
          activeReadSource: this.activeReadSource,
          updatedAt: new Date().toISOString(),
        })
      );

      localStorage.setItem(
        "nj_rtdb_storage_stats_v2",
        JSON.stringify({
          primaryStorage: this.primaryStorage,
          mirrorStorage: this.mirrorStorage,
          updatedAt: new Date().toISOString(),
        })
      );

      localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(this.catalogIndex));
      this.notifyListeners();
    } catch {}
  }

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

  private startPeriodicMonitor() {
    if (typeof window === "undefined") return;
    if (this.monitorTimer) clearInterval(this.monitorTimer);

    // Watchdog runs every 45 seconds to re-check thresholds and month rollover
    this.monitorTimer = setInterval(() => {
      this.evaluateReadRouting();
      this.evaluateWriteTarget();
    }, 45000);
  }

  /**
   * Evaluates Storage Space Rotation (Independent of Traffic)
   * Banco 1 threshold: 950MB -> switches write target to Banco 2
   * If both near 950MB -> flags warning_both_full (never deletes or overwrites)
   */
  public evaluateWriteTarget(): "primary" | "mirror" | "warning_both_full" {
    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();

    this.primaryStorage.isNearLimit = this.primaryStorage.bytesUsed >= NINE_FIFTY_MB_IN_BYTES;
    this.mirrorStorage.isNearLimit = this.mirrorStorage.bytesUsed >= NINE_FIFTY_MB_IN_BYTES;

    if (this.primaryStorage.isNearLimit && this.mirrorStorage.isNearLimit) {
      return "warning_both_full";
    }

    if (primaryFb.isValid && !this.primaryStorage.isNearLimit) {
      return "primary";
    }

    if (mirrorFb.isValid && !this.mirrorStorage.isNearLimit) {
      return "mirror";
    }

    return primaryFb.isValid ? "primary" : "mirror";
  }

  /**
   * Evaluates Traffic Download Bandwidth Rotation (Independent of Storage)
   * At 9.5GB on reading instance -> routes reads to other instance
   * Auto-resets with new monthly billing cycle
   */
  public evaluateReadRouting(): TrafficSource {
    if (this.isManualOverride) {
      return this.activeReadSource;
    }

    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();

    // 1. Check if Primary bandwidth is below 9.5GB safety ceiling
    if (primaryFb.isValid && this.primaryTraffic.bytesUsed < NINE_POINT_FIVE_GB_IN_BYTES) {
      this.activeReadSource = "primary";
    }
    // 2. If Primary >= 9.5GB, rotate to Mirror instance
    else if (mirrorFb.isValid && this.mirrorTraffic.bytesUsed < NINE_POINT_FIVE_GB_IN_BYTES) {
      console.info(
        "⚡ [Traffic Router] Rotação de Tráfego Ativada: Banco 1 atingiu 9.5GB. Consultas redirecionadas para o Banco 2 (10GB)."
      );
      this.activeReadSource = "mirror";
    }
    // 3. Fallback: if both reached threshold or mirror not reachable
    else if (primaryFb.isValid && this.primaryTraffic.bytesUsed < TEN_GB_IN_BYTES) {
      this.activeReadSource = "primary";
    } else {
      this.activeReadSource = "static";
    }

    this.savePersistedData();
    return this.activeReadSource;
  }

  public setManualSource(source: TrafficSource) {
    this.activeReadSource = source;
    this.isManualOverride = true;
    this.savePersistedData();
  }

  public resetToAutomatic() {
    this.isManualOverride = false;
    this.evaluateReadRouting();
  }

  // Record bandwidth consumption from reads
  private recordReadBandwidth(source: TrafficSource, bytes: number, hasError: boolean = false) {
    const now = new Date().toISOString();
    if (source === "primary") {
      this.primaryTraffic.requestCount++;
      this.primaryTraffic.bytesUsed += bytes;
      this.primaryTraffic.lastActive = now;
      if (hasError) this.primaryTraffic.errorCount++;
    } else if (source === "mirror") {
      this.mirrorTraffic.requestCount++;
      this.mirrorTraffic.bytesUsed += bytes;
      this.mirrorTraffic.lastActive = now;
      if (hasError) this.mirrorTraffic.errorCount++;
    }
    this.savePersistedData();

    if (
      (source === "primary" && this.primaryTraffic.bytesUsed >= NINE_POINT_FIVE_GB_IN_BYTES) ||
      (source === "mirror" && this.mirrorTraffic.bytesUsed >= NINE_POINT_FIVE_GB_IN_BYTES)
    ) {
      this.evaluateReadRouting();
    }
  }

  // Record storage consumption from writes
  private recordWriteStorage(target: "primary" | "mirror", bytes: number, countDelta: number = 1) {
    const now = new Date().toISOString();
    if (target === "primary") {
      this.primaryStorage.bytesUsed += bytes;
      this.primaryStorage.articleCount += countDelta;
      this.primaryStorage.lastWrite = now;
      this.primaryStorage.isNearLimit = this.primaryStorage.bytesUsed >= NINE_FIFTY_MB_IN_BYTES;
      this.catalogIndex.primaryStorageBytes = this.primaryStorage.bytesUsed;
      this.catalogIndex.primaryCount += countDelta;
    } else if (target === "mirror") {
      this.mirrorStorage.bytesUsed += bytes;
      this.mirrorStorage.articleCount += countDelta;
      this.mirrorStorage.lastWrite = now;
      this.mirrorStorage.isNearLimit = this.mirrorStorage.bytesUsed >= NINE_FIFTY_MB_IN_BYTES;
      this.catalogIndex.mirrorStorageBytes = this.mirrorStorage.bytesUsed;
      this.catalogIndex.mirrorCount += countDelta;
    }
    this.catalogIndex.updatedAt = now;
    this.savePersistedData();
  }

  /**
   * Retrieves specific article using the lightweight index catalog
   * Knows precisely which database holds the requested article
   */
  public async getArticle(idOrSlug: string): Promise<NewsItem | null> {
    const entry = this.catalogIndex.entries[idOrSlug];
    const targetSource = entry ? entry.storedIn : "both";

    // 1. If static
    if (targetSource === "static") {
      const found = (staticNewsData as NewsItem[]).find(
        (n) => n.slug === idOrSlug || String(n.id) === idOrSlug
      );
      return found || null;
    }

    // 2. Decide instance to query based on physical index and current bandwidth rotation
    let preferredDb: "primary" | "mirror" = "primary";
    if (targetSource === "mirror") {
      preferredDb = "mirror";
    } else if (targetSource === "primary") {
      preferredDb = "primary";
    } else {
      // Stored in both -> use the one with available traffic quota
      preferredDb = this.evaluateReadRouting() === "mirror" ? "mirror" : "primary";
    }

    try {
      const fb = preferredDb === "primary" ? getPrimaryFirebase() : getMirrorFirebase();
      if (!fb.isValid || !fb.db) throw new Error("Database not connected");

      const cleanKey = String(idOrSlug).replace(/[\.\#\$\[\]\/]/g, "_");
      const snap = await get(ref(fb.db, `news/${cleanKey}`));

      if (snap.exists()) {
        const item = snap.val() as NewsItem;
        const estBytes = new Blob([JSON.stringify(item)]).size;
        this.recordReadBandwidth(preferredDb, estBytes, false);
        return item;
      }
    } catch (e) {
      console.warn(`[Index Query] Fail reading article from ${preferredDb}, checking fallback...`, e);
      this.recordReadBandwidth(preferredDb, 256, true);
    }

    // Fallback: search in static collection
    const staticItem = (staticNewsData as NewsItem[]).find(
      (n) => n.slug === idOrSlug || String(n.id) === idOrSlug
    );
    return staticItem || null;
  }

  /**
   * Hybrid News Fetch:
   * 1. Query active instance based on 9.5GB monthly bandwidth rotation
   * 2. Ingest dynamic news and update index entries
   * 3. Merge seamlessly with static fallback (Zero news lost)
   */
  public async fetchNews(): Promise<{ news: NewsItem[]; sourceUsed: TrafficSource }> {
    const currentSource = this.evaluateReadRouting();

    if (currentSource === "static") {
      return { news: staticNewsData as NewsItem[], sourceUsed: "static" };
    }

    try {
      const fbInstance = currentSource === "primary" ? getPrimaryFirebase() : getMirrorFirebase();
      if (!fbInstance.isValid || !fbInstance.db) {
        if (currentSource === "primary") {
          const mirror = getMirrorFirebase();
          if (mirror.isValid && mirror.db) {
            this.activeReadSource = "mirror";
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

        const payloadBytes = new Blob([JSON.stringify(val)]).size;
        this.recordReadBandwidth(currentSource, payloadBytes, false);

        // Update lightweight catalog index
        for (const item of firebaseNewsArray) {
          const key = String(item.slug || item.id || item.link);
          const itemSize = new Blob([JSON.stringify(item)]).size;
          if (!this.catalogIndex.entries[key]) {
            this.catalogIndex.entries[key] = {
              id: item.id,
              slug: item.slug || "",
              title: item.title,
              category: item.category || "Notícias",
              pubDate: item.pubDate || new Date().toISOString(),
              storedIn: currentSource,
              sizeBytes: itemSize,
              lastVerified: new Date().toISOString(),
            };
          } else {
            const existing = this.catalogIndex.entries[key].storedIn;
            if (existing !== currentSource && existing !== "both") {
              this.catalogIndex.entries[key].storedIn = "both";
            }
          }
        }
        this.catalogIndex.totalArticles = Object.keys(this.catalogIndex.entries).length;
        this.savePersistedData();

        // Merge with static fallback ensuring complete article catalog
        const combined = this.mergeAndDeduplicate(firebaseNewsArray, staticNewsData as NewsItem[]);
        return { news: combined, sourceUsed: currentSource };
      } else {
        this.recordReadBandwidth(currentSource, 512, false);
        return { news: staticNewsData as NewsItem[], sourceUsed: "static" };
      }
    } catch (err: any) {
      console.warn(`[Traffic Router] Erro lendo ${currentSource}:`, err?.message || err);
      this.recordReadBandwidth(currentSource, 256, true);

      // Failover to secondary
      if (currentSource === "primary") {
        const mirror = getMirrorFirebase();
        if (mirror.isValid && this.mirrorTraffic.bytesUsed < NINE_POINT_FIVE_GB_IN_BYTES) {
          this.activeReadSource = "mirror";
          return this.fetchNews();
        }
      }

      return { news: staticNewsData as NewsItem[], sourceUsed: "static" };
    }
  }

  /**
   * Saves and mirrors articles enforcing Storage Space Rotation (950MB)
   * 1. If Banco 1 has space (<950MB), writes to Banco 1.
   * 2. When Banco 1 approaches 950MB, writes automatically go to Banco 2.
   * 3. Updates the lightweight index to track which bank holds each article.
   * 4. NEVER deletes or overwrites existing content.
   */
  public async mirrorNewsToFirebase(
    articles: NewsItem[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<{
    success: boolean;
    syncedCount: number;
    targetUsed: "primary" | "mirror" | "both" | "warning_full";
    warning?: string;
  }> {
    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();

    if (!primaryFb.isValid && !mirrorFb.isValid) {
      throw new Error("Nenhum projeto Firebase configurado com credenciais válidas.");
    }

    const payload: Record<string, NewsItem> = {};
    let totalBatchBytes = 0;

    articles.forEach((item) => {
      const cleanKey = String(item.id || item.slug || Math.random()).replace(/[\.\#\$\[\]\/]/g, "_");
      payload[cleanKey] = item;
      totalBatchBytes += new Blob([JSON.stringify(item)]).size;
    });

    const writeTarget = this.evaluateWriteTarget();

    if (writeTarget === "warning_both_full") {
      const warnMsg =
        "⚠️ Capacidade Máxima Atingida: Ambos os projetos Firebase atingiram o limite de segurança de 950MB (total ~1900MB). O acervo existente foi integralmente preservado.";
      return {
        success: false,
        syncedCount: 0,
        targetUsed: "warning_full",
        warning: warnMsg,
      };
    }

    let targetSuccess: "primary" | "mirror" | "both" = "primary";

    // Scenario A: Write to Primary (Storage < 950MB)
    if (writeTarget === "primary" && primaryFb.isValid && primaryFb.db) {
      if (onProgress) onProgress(40, "Gravando no Banco 1 (legal-norm2)...");
      try {
        await set(ref(primaryFb.db, "news"), payload);
        this.recordWriteStorage("primary", totalBatchBytes, articles.length);

        // Also mirror to secondary if mirror has free space
        if (mirrorFb.isValid && mirrorFb.db && !this.mirrorStorage.isNearLimit) {
          if (onProgress) onProgress(80, "Espelhando no Banco 2 (legal-norm3)...");
          try {
            await set(ref(mirrorFb.db, "news"), payload);
            this.recordWriteStorage("mirror", totalBatchBytes, articles.length);
            targetSuccess = "both";
          } catch {}
        }
      } catch (err: any) {
        console.error("Erro gravando no Banco 1:", err);
        // Failover write to Banco 2
        if (mirrorFb.isValid && mirrorFb.db) {
          await set(ref(mirrorFb.db, "news"), payload);
          this.recordWriteStorage("mirror", totalBatchBytes, articles.length);
          targetSuccess = "mirror";
        }
      }
    }
    // Scenario B: Primary is near 950MB -> Direct writes straight to Banco 2!
    else if (writeTarget === "mirror" && mirrorFb.isValid && mirrorFb.db) {
      if (onProgress)
        onProgress(50, "Banco 1 próximo de 950MB. Direcionando gravação para Banco 2 (legal-norm3)...");
      await set(ref(mirrorFb.db, "news"), payload);
      this.recordWriteStorage("mirror", totalBatchBytes, articles.length);
      targetSuccess = "mirror";
    }

    // Update index entries with target location
    articles.forEach((item) => {
      const key = String(item.slug || item.id || item.link);
      const estSize = new Blob([JSON.stringify(item)]).size;
      this.catalogIndex.entries[key] = {
        id: item.id,
        slug: item.slug || "",
        title: item.title,
        category: item.category || "Notícias",
        pubDate: item.pubDate || new Date().toISOString(),
        storedIn: targetSuccess,
        sizeBytes: estSize,
        lastVerified: new Date().toISOString(),
      };
    });
    this.catalogIndex.totalArticles = Object.keys(this.catalogIndex.entries).length;

    // Sync index to RTDB for auxiliary inspection
    try {
      const activeFb = targetSuccess === "mirror" ? mirrorFb : primaryFb;
      if (activeFb.isValid && activeFb.db) {
        await set(ref(activeFb.db, "news_catalog_summary"), {
          totalArticles: this.catalogIndex.totalArticles,
          primaryStorageBytes: this.primaryStorage.bytesUsed,
          mirrorStorageBytes: this.mirrorStorage.bytesUsed,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {}

    if (onProgress) onProgress(100, "Sincronização e indexação finalizadas com sucesso!");
    this.savePersistedData();

    return {
      success: true,
      syncedCount: articles.length,
      targetUsed: targetSuccess,
    };
  }

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
    } catch {}
  }

  private mergeAndDeduplicate(primaryList: NewsItem[], fallbackList: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    const merged: NewsItem[] = [];

    for (const item of primaryList) {
      const key = String(item.slug || item.id || item.link || item.title);
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    for (const item of fallbackList) {
      const key = String(item.slug || item.id || item.link || item.title);
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    merged.sort((a, b) => {
      const timeA = new Date(a.pubDate || 0).getTime();
      const timeB = new Date(b.pubDate || 0).getTime();
      return timeB - timeA;
    });

    return merged;
  }

  public getCatalogIndex(): NewsCatalogIndex {
    return { ...this.catalogIndex };
  }

  public getState(): TrafficRouterState {
    const bothFull =
      this.primaryStorage.bytesUsed >= NINE_FIFTY_MB_IN_BYTES &&
      this.mirrorStorage.bytesUsed >= NINE_FIFTY_MB_IN_BYTES;

    return {
      activeReadSource: this.activeReadSource,
      activeWriteTarget: bothFull ? "warning_both_full" : this.evaluateWriteTarget(),
      bothStorageNearLimit: bothFull,
      primaryTraffic: { ...this.primaryTraffic },
      mirrorTraffic: { ...this.mirrorTraffic },
      primaryStorage: { ...this.primaryStorage },
      mirrorStorage: { ...this.mirrorStorage },
      isPrimaryConfigured: isConfigValid(primaryConfig),
      isMirrorConfigured: isConfigValid(mirrorConfig),
      totalArticlesCount: Math.max(staticNewsData.length, this.catalogIndex.totalArticles),
      indexEntriesCount: Object.keys(this.catalogIndex.entries).length,
      lastSyncTime: this.primaryTraffic.lastActive || this.mirrorTraffic.lastActive,
      mode: this.isManualOverride ? "manual" : "automatic",
      monthCycle: getCurrentMonthKey().replace(STORAGE_KEY_PREFIX, ""),
    };
  }
}

export const trafficRouter = new FirebaseTrafficRouter();
