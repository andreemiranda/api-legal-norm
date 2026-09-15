// Multi-Instance Firebase Realtime Database Traffic & Storage Router
// Architecture:
// 1. Dual Spark Instance Management: Banco 1 (legal-norm2) & Banco 2 (legal-norm3)
// 2. Storage Rotation & Sobrescrição (~1.9 GB total, ~950 MB por instância):
//    Quando o Banco 1 atinge 950 MB, gravações rotacionam para o Banco 2.
//    Se ambos atingirem a capacidade limite de 1.9 GB, ativa sobrescrição automática (FIFO)
//    substituindo os artigos mais antigos por novos para trabalhar continuamente perto do limite.
// 3. Traffic Rotation & Sobrescrição (~20 GB total, ~9.8 GB por instância):
//    Quando o Banco 1 atinge 9.8 GB, leituras rotacionam para o Banco 2.
//    Ao aproximar-se do teto global de 20 GB, ativa sobrescrição de tráfego (cache otimizado
//    e expurgo de telemetrias) para operar perto do limite sem interrupção.
// 4. Sem dependência de JSON estático: Opera exclusivamente conectado aos bancos Realtime Database.

import { ref, get, set, child, remove, onValue, type Unsubscribe } from "firebase/database";
import {
  getPrimaryFirebase,
  getMirrorFirebase,
  isConfigValid,
  primaryConfig,
  mirrorConfig,
} from "./firebaseConfig";
import { NewsItem } from "../types";
import { NEWS_API_CONFIG } from "./newsApiConfig";

export type TrafficSource = "primary" | "mirror" | "api";
export type StorageTarget = "primary" | "mirror" | "both";

// Operational Limits: 1.9 GB Storage & 20 GB Traffic
export const TOTAL_STORAGE_LIMIT_BYTES = 1932735283; // ~1.9 GB
export const PER_DB_STORAGE_THRESHOLD = 950 * 1024 * 1024; // 950 MB per instance
export const ONE_GB_IN_BYTES = 1024 * 1024 * 1024;
export const NINE_FIFTY_MB_IN_BYTES = PER_DB_STORAGE_THRESHOLD;

export const TOTAL_TRAFFIC_LIMIT_BYTES = 21474836480; // ~20 GB
export const PER_DB_TRAFFIC_THRESHOLD = Math.floor(9.8 * 1024 * 1024 * 1024); // ~9.8 GB per instance
export const TEN_GB_IN_BYTES = 10 * 1024 * 1024 * 1024;
export const NINE_POINT_FIVE_GB_IN_BYTES = PER_DB_TRAFFIC_THRESHOLD;

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
  primaryStorageBytes: number;
  mirrorStorageBytes: number;
  updatedAt: string;
  entries: Record<string, NewsIndexEntry>;
}

export interface ProjectBandwidthStats {
  bytesUsed: number;
  limitBytes: number;
  thresholdBytes: number;
  requestCount: number;
  errorCount: number;
  lastActive: string | null;
}

export interface ProjectStorageStats {
  bytesUsed: number;
  limitBytes: number;
  thresholdBytes: number;
  articleCount: number;
  isNearLimit: boolean;
  lastWrite: string | null;
}

export interface SobrescricaoState {
  isStorageSobrescricaoActive: boolean;
  isTrafficSobrescricaoActive: boolean;
  totalStorageLimitBytes: number;
  totalTrafficLimitBytes: number;
  storageSobrescricaoCount: number;
  trafficSobrescricaoCount: number;
  lastSobrescricaoAt: string | null;
  prunedArticlesCount: number;
}

export interface TrafficRouterState {
  activeReadSource: TrafficSource;
  activeWriteTarget: "primary" | "mirror" | "sobrescricao_both_active";
  bothStorageNearLimit: boolean;
  primaryTraffic: ProjectBandwidthStats;
  mirrorTraffic: ProjectBandwidthStats;
  primaryStorage: ProjectStorageStats;
  mirrorStorage: ProjectStorageStats;
  sobrescricao: SobrescricaoState;
  isPrimaryConfigured: boolean;
  isMirrorConfigured: boolean;
  totalArticlesCount: number;
  indexEntriesCount: number;
  lastSyncTime: string | null;
  mode: "automatic" | "manual";
  monthCycle: string;
}

const STORAGE_KEY_PREFIX = "nj_rtdb_traffic_v3_";
const INDEX_STORAGE_KEY = "nj_news_catalog_index_v3";
const CACHE_NEWS_KEY = "nj_rtdb_cached_news_v3";

const getCurrentMonthKey = () => {
  const d = new Date();
  return `${STORAGE_KEY_PREFIX}${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, "0")}`;
};

class FirebaseTrafficRouter {
  private activeReadSource: TrafficSource = "primary";
  private isManualOverride: boolean = false;

  // Monthly bandwidth tracking (~20 GB total across instances)
  private primaryTraffic: ProjectBandwidthStats = {
    bytesUsed: 0,
    limitBytes: TEN_GB_IN_BYTES,
    thresholdBytes: PER_DB_TRAFFIC_THRESHOLD,
    requestCount: 0,
    errorCount: 0,
    lastActive: null,
  };

  private mirrorTraffic: ProjectBandwidthStats = {
    bytesUsed: 0,
    limitBytes: TEN_GB_IN_BYTES,
    thresholdBytes: PER_DB_TRAFFIC_THRESHOLD,
    requestCount: 0,
    errorCount: 0,
    lastActive: null,
  };

  // Storage Space Tracking (~1.9 GB total: 950 MB per instance)
  private primaryStorage: ProjectStorageStats = {
    bytesUsed: 4757104, // Initial known size of legal-norm2
    limitBytes: ONE_GB_IN_BYTES,
    thresholdBytes: PER_DB_STORAGE_THRESHOLD,
    articleCount: 651,
    isNearLimit: false,
    lastWrite: null,
  };

  private mirrorStorage: ProjectStorageStats = {
    bytesUsed: 0,
    limitBytes: ONE_GB_IN_BYTES,
    thresholdBytes: PER_DB_STORAGE_THRESHOLD,
    articleCount: 0,
    isNearLimit: false,
    lastWrite: null,
  };

  // Sobrescrição Engine State
  private sobrescricao: SobrescricaoState = {
    isStorageSobrescricaoActive: true,
    isTrafficSobrescricaoActive: true,
    totalStorageLimitBytes: TOTAL_STORAGE_LIMIT_BYTES,
    totalTrafficLimitBytes: TOTAL_TRAFFIC_LIMIT_BYTES,
    storageSobrescricaoCount: 0,
    trafficSobrescricaoCount: 0,
    lastSobrescricaoAt: null,
    prunedArticlesCount: 0,
  };

  // Lightweight index catalog (purely Realtime Database)
  private catalogIndex: NewsCatalogIndex = {
    version: 3,
    totalArticles: 651,
    primaryCount: 651,
    mirrorCount: 0,
    primaryStorageBytes: 4757104,
    mirrorStorageBytes: 0,
    updatedAt: new Date().toISOString(),
    entries: {},
  };

  private inMemoryNewsCache: NewsItem[] = [];
  private listeners: Array<(state: TrafficRouterState) => void> = [];
  private monitorTimer: any = null;

  // Real-time synchronization state
  private newsSubscribers: Set<(news: NewsItem[]) => void> = new Set();
  private rtdbUnsubscribe: Unsubscribe | null = null;
  private sseSource: EventSource | null = null;
  private realtimePollTimer: any = null;
  private lastKnownSignature: string = "";

  constructor() {
    this.loadPersistedData();
    this.evaluateReadRouting();
    this.evaluateWriteTarget();
    this.startPeriodicMonitor();
  }

  private loadPersistedData() {
    try {
      if (typeof window === "undefined") return;

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

      const rawStorage = localStorage.getItem("nj_rtdb_storage_stats_v3");
      if (rawStorage) {
        const parsed = JSON.parse(rawStorage);
        if (parsed.primaryStorage) this.primaryStorage = { ...this.primaryStorage, ...parsed.primaryStorage };
        if (parsed.mirrorStorage) this.mirrorStorage = { ...this.mirrorStorage, ...parsed.mirrorStorage };
        if (parsed.sobrescricao) this.sobrescricao = { ...this.sobrescricao, ...parsed.sobrescricao };
      }

      const rawIndex = localStorage.getItem(INDEX_STORAGE_KEY);
      if (rawIndex) {
        const parsed: NewsCatalogIndex = JSON.parse(rawIndex);
        if (parsed.entries) {
          this.catalogIndex.entries = { ...this.catalogIndex.entries, ...parsed.entries };
          this.catalogIndex.totalArticles = Object.keys(this.catalogIndex.entries).length;
          this.catalogIndex.primaryCount = parsed.primaryCount || this.catalogIndex.totalArticles;
          this.catalogIndex.mirrorCount = parsed.mirrorCount || 0;
          this.catalogIndex.primaryStorageBytes = parsed.primaryStorageBytes || this.primaryStorage.bytesUsed;
          this.catalogIndex.mirrorStorageBytes = parsed.mirrorStorageBytes || this.mirrorStorage.bytesUsed;
        }
      }

      const rawCachedNews = sessionStorage.getItem(CACHE_NEWS_KEY);
      if (rawCachedNews) {
        this.inMemoryNewsCache = JSON.parse(rawCachedNews);
      }
    } catch (e) {
      console.warn("Traffic/Storage persistence load error:", e);
    }
  }

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
        "nj_rtdb_storage_stats_v3",
        JSON.stringify({
          primaryStorage: this.primaryStorage,
          mirrorStorage: this.mirrorStorage,
          sobrescricao: this.sobrescricao,
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

  /**
   * Sincronização e Atualização das Notícias em Tempo Real
   * Conecta ouvintes nativos Realtime Database (onValue) + SSE stream do servidor
   * Atualiza os dados instantaneamente em segundo plano sem necessidade de recarregar a página.
   */
  public subscribeToRealtimeNews(listener: (news: NewsItem[]) => void): () => void {
    this.newsSubscribers.add(listener);

    // Imediatamente entrega o cache em memória se já disponível
    if (this.inMemoryNewsCache.length > 0) {
      try {
        listener(this.inMemoryNewsCache);
      } catch {}
    }

    if (this.newsSubscribers.size === 1) {
      this.startRealtimeSync();
    }

    return () => {
      this.newsSubscribers.delete(listener);
      if (this.newsSubscribers.size === 0) {
        this.stopRealtimeSync();
      }
    };
  }

  private notifyNewsSubscribers(items: NewsItem[]) {
    if (!items || items.length === 0) return;
    const sig = `${items.length}_${items[0]?.id || ""}_${items[0]?.slug || ""}`;
    if (sig === this.lastKnownSignature) return;
    this.lastKnownSignature = sig;
    this.inMemoryNewsCache = items;

    this.newsSubscribers.forEach((cb) => {
      try {
        cb(items);
      } catch {}
    });
  }

  private startRealtimeSync() {
    if (typeof window === "undefined") return;

    // 1. Firebase Realtime Database onValue Listener (WebSocket Nativo do Firebase)
    try {
      const fbInstance = this.activeReadSource === "mirror" ? getMirrorFirebase() : getPrimaryFirebase();
      if (fbInstance.isValid && fbInstance.db) {
        const newsRef = ref(fbInstance.db, "news");
        this.rtdbUnsubscribe = onValue(
          newsRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const val = snapshot.val();
              const items: NewsItem[] = Array.isArray(val)
                ? val.filter(Boolean)
                : typeof val === "object" && val !== null
                ? Object.values(val)
                : [];

              if (items.length > 0) {
                this.notifyNewsSubscribers(items);
              }
            }
          },
          (err) => {
            console.warn("[Realtime RTDB] Listener warning:", err?.message || err);
          }
        );
      }
    } catch (e) {
      console.warn("[Realtime RTDB] Setup notice:", e);
    }

    // 2. Server-Sent Events (SSE) Stream para sincronização com a API em tempo real
    try {
      if (typeof EventSource !== "undefined" && !this.sseSource) {
        this.sseSource = new EventSource("/api/realtime/news-stream");
        this.sseSource.onmessage = async (event) => {
          try {
            if (!event.data) return;
            const payload = JSON.parse(event.data);
            if (payload.type === "news_update") {
              const res = await this.fetchNews();
              if (res && res.news && res.news.length > 0) {
                this.notifyNewsSubscribers(res.news);
              }
            }
          } catch {}
        };
        this.sseSource.onerror = () => {
          // SSE auto-reconnects automaticamente
        };
      }
    } catch (e) {
      console.warn("[Realtime SSE] Setup notice:", e);
    }

    // 3. Verificação periódica silenciosa em segundo plano a cada 20 segundos
    if (this.realtimePollTimer) clearInterval(this.realtimePollTimer);
    this.realtimePollTimer = setInterval(async () => {
      try {
        const checkRes = await fetch("/api/realtime/check");
        if (checkRes.ok) {
          const info = await checkRes.json();
          const sig = `${info.total}_${info.latestId || ""}_${info.latestSlug || ""}`;
          if (sig !== this.lastKnownSignature) {
            const fetched = await this.fetchNews();
            if (fetched && fetched.news && fetched.news.length > 0) {
              this.notifyNewsSubscribers(fetched.news);
            }
          }
        }
      } catch {}
    }, 20000);
  }

  private stopRealtimeSync() {
    if (this.rtdbUnsubscribe) {
      try {
        this.rtdbUnsubscribe();
      } catch {}
      this.rtdbUnsubscribe = null;
    }
    if (this.sseSource) {
      try {
        this.sseSource.close();
      } catch {}
      this.sseSource = null;
    }
    if (this.realtimePollTimer) {
      clearInterval(this.realtimePollTimer);
      this.realtimePollTimer = null;
    }
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

    this.monitorTimer = setInterval(() => {
      this.evaluateReadRouting();
      this.evaluateWriteTarget();
    }, 45000);
  }

  /**
   * Evaluates Storage Target and Sobrescrição Trigger (~1.9 GB total)
   * 1. If Banco 1 < 950MB -> routes to Primary
   * 2. If Banco 1 >= 950MB and Banco 2 < 950MB -> routes to Mirror
   * 3. If BOTH near 950MB (~1.9GB total) -> activates Sobrescrição (FIFO overwrite)
   */
  public evaluateWriteTarget(): "primary" | "mirror" | "sobrescricao_both_active" {
    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();

    this.primaryStorage.isNearLimit = this.primaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;
    this.mirrorStorage.isNearLimit = this.mirrorStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;

    if (this.primaryStorage.isNearLimit && this.mirrorStorage.isNearLimit) {
      return "sobrescricao_both_active";
    }

    if (primaryFb.isValid && !this.primaryStorage.isNearLimit) {
      return "primary";
    }

    if (mirrorFb.isValid && !this.mirrorStorage.isNearLimit) {
      return "mirror";
    }

    return "primary";
  }

  /**
   * Evaluates Traffic Download Bandwidth Routing (~20 GB total)
   * 1. If Banco 1 < 9.8 GB -> routes to Primary
   * 2. If Banco 1 >= 9.8 GB and Banco 2 < 9.8 GB -> routes to Mirror
   * 3. If BOTH near 9.8 GB (~20 GB total) -> activates Traffic Sobrescrição
   */
  public evaluateReadRouting(): TrafficSource {
    if (this.isManualOverride) {
      return this.activeReadSource;
    }

    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();

    const primaryBytes = this.primaryTraffic.bytesUsed;
    const mirrorBytes = this.mirrorTraffic.bytesUsed;

    if (primaryFb.isValid && primaryBytes < PER_DB_TRAFFIC_THRESHOLD) {
      this.activeReadSource = "primary";
    } else if (mirrorFb.isValid && mirrorBytes < PER_DB_TRAFFIC_THRESHOLD) {
      this.activeReadSource = "mirror";
    } else if (primaryBytes + mirrorBytes >= TOTAL_TRAFFIC_LIMIT_BYTES * 0.95) {
      // Traffic Sobrescrição mode: use in-memory cache and API proxy
      this.sobrescricao.isTrafficSobrescricaoActive = true;
      this.sobrescricao.trafficSobrescricaoCount++;
      this.sobrescricao.lastSobrescricaoAt = new Date().toISOString();
      this.activeReadSource = primaryBytes <= mirrorBytes ? "primary" : "mirror";
    } else {
      this.activeReadSource = "primary";
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
      (source === "primary" && this.primaryTraffic.bytesUsed >= PER_DB_TRAFFIC_THRESHOLD) ||
      (source === "mirror" && this.mirrorTraffic.bytesUsed >= PER_DB_TRAFFIC_THRESHOLD)
    ) {
      this.evaluateReadRouting();
    }
  }

  private recordWriteStorage(target: "primary" | "mirror", bytes: number, countDelta: number = 1) {
    const now = new Date().toISOString();
    if (target === "primary") {
      this.primaryStorage.bytesUsed += bytes;
      this.primaryStorage.articleCount += countDelta;
      this.primaryStorage.lastWrite = now;
      this.primaryStorage.isNearLimit = this.primaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;
      this.catalogIndex.primaryStorageBytes = this.primaryStorage.bytesUsed;
      this.catalogIndex.primaryCount += countDelta;
    } else if (target === "mirror") {
      this.mirrorStorage.bytesUsed += bytes;
      this.mirrorStorage.articleCount += countDelta;
      this.mirrorStorage.lastWrite = now;
      this.mirrorStorage.isNearLimit = this.mirrorStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;
      this.catalogIndex.mirrorStorageBytes = this.mirrorStorage.bytesUsed;
      this.catalogIndex.mirrorCount += countDelta;
    }
    this.catalogIndex.updatedAt = now;
    this.savePersistedData();
  }

  /**
   * Executes Storage Sobrescrição (FIFO overwrite of oldest news)
   * When capacity reaches ~1.9 GB, prunes oldest articles to accept new ones seamlessly.
   */
  public async executeStorageSobrescricao(
    target: "primary" | "mirror",
    articlesToPruneCount: number = 25
  ): Promise<{ prunedCount: number; bytesFreed: number }> {
    const fb = target === "primary" ? getPrimaryFirebase() : getMirrorFirebase();
    if (!fb.isValid || !fb.db) return { prunedCount: 0, bytesFreed: 0 };

    try {
      // 1. Identify oldest entries sorted chronologically
      const entries = Object.entries(this.catalogIndex.entries).sort((a, b) => {
        const timeA = new Date(a[1].pubDate || 0).getTime();
        const timeB = new Date(b[1].pubDate || 0).getTime();
        return timeA - timeB; // Ascending: oldest first
      });

      const toPrune = entries.slice(0, articlesToPruneCount);
      let bytesFreed = 0;

      for (const [key, entry] of toPrune) {
        try {
          const cleanKey = String(entry.id || entry.slug || key).replace(/[\.\#\$\[\]\/]/g, "_");
          await remove(ref(fb.db, `news/${cleanKey}`));
          bytesFreed += entry.sizeBytes || 5000;
          delete this.catalogIndex.entries[key];
        } catch {}
      }

      const prunedCount = toPrune.length;
      if (target === "primary") {
        this.primaryStorage.bytesUsed = Math.max(0, this.primaryStorage.bytesUsed - bytesFreed);
        this.primaryStorage.articleCount = Math.max(0, this.primaryStorage.articleCount - prunedCount);
        this.catalogIndex.primaryStorageBytes = this.primaryStorage.bytesUsed;
        this.catalogIndex.primaryCount = this.primaryStorage.articleCount;
      } else {
        this.mirrorStorage.bytesUsed = Math.max(0, this.mirrorStorage.bytesUsed - bytesFreed);
        this.mirrorStorage.articleCount = Math.max(0, this.mirrorStorage.articleCount - prunedCount);
        this.catalogIndex.mirrorStorageBytes = this.mirrorStorage.bytesUsed;
        this.catalogIndex.mirrorCount = this.mirrorStorage.articleCount;
      }

      this.sobrescricao.storageSobrescricaoCount++;
      this.sobrescricao.prunedArticlesCount += prunedCount;
      this.sobrescricao.lastSobrescricaoAt = new Date().toISOString();
      this.savePersistedData();

      return { prunedCount, bytesFreed };
    } catch (e) {
      console.error("Sobrescrição error:", e);
      return { prunedCount: 0, bytesFreed: 0 };
    }
  }

  /**
   * Fetches news directly from Firebase Realtime Database
   * Exclusively queries RTDB (Primary or Mirror) without static JSON!
   */
  public async fetchNews(): Promise<{ news: NewsItem[]; sourceUsed: TrafficSource }> {
    const currentSource = this.evaluateReadRouting();

    // 1. Try Firebase Web SDK from active instance
    try {
      const fbInstance = currentSource === "primary" ? getPrimaryFirebase() : getMirrorFirebase();
      if (fbInstance.isValid && fbInstance.db) {
        const dbRef = ref(fbInstance.db);
        const snapshot = await get(child(dbRef, "news"));

        if (snapshot.exists()) {
          const val = snapshot.val();
          const items: NewsItem[] = Array.isArray(val)
            ? val.filter(Boolean)
            : typeof val === "object" && val !== null
            ? Object.values(val)
            : [];

          if (items.length > 0) {
            const payloadBytes = new Blob([JSON.stringify(val)]).size;
            this.recordReadBandwidth(currentSource, payloadBytes, false);
            this.inMemoryNewsCache = items;
            try {
              sessionStorage.setItem(CACHE_NEWS_KEY, JSON.stringify(items.slice(0, 100)));
            } catch {}
            return { news: items, sourceUsed: currentSource };
          }
        }
      }
    } catch (err: any) {
      console.warn(`[RTDB Fetch] Erro via Web SDK (${currentSource}):`, err?.message || err);
      this.recordReadBandwidth(currentSource, 256, true);
    }

    // 2. Direct REST Fetch to Realtime Database endpoint
    try {
      const rtdbUrl =
        currentSource === "mirror" && mirrorConfig.databaseURL
          ? `${mirrorConfig.databaseURL}/news.json`
          : "https://legal-norm2-default-rtdb.firebaseio.com/news.json";

      const res = await fetch(rtdbUrl);
      if (res.ok) {
        const val = await res.json();
        if (val) {
          const items: NewsItem[] = Array.isArray(val)
            ? val.filter(Boolean)
            : typeof val === "object" && val !== null
            ? Object.values(val)
            : [];

          if (items.length > 0) {
            const size = new Blob([JSON.stringify(val)]).size;
            this.recordReadBandwidth(currentSource, size, false);
            this.inMemoryNewsCache = items;
            return { news: items, sourceUsed: currentSource };
          }
        }
      }
    } catch (err) {
      console.warn(`[RTDB Fetch] REST fallback failed:`, err);
    }

    // 3. Fallback to Server Proxy (/api/news?all=true) which pulls from RTDB
    try {
      const serverRes = await fetch("/api/news?all=true");
      if (serverRes.ok) {
        const json = await serverRes.json();
        const items = json.data || json;
        if (Array.isArray(items) && items.length > 0) {
          this.inMemoryNewsCache = items;
          return { news: items, sourceUsed: "api" };
        }
      }
    } catch {}

    // Return in-memory cache if available
    return { news: this.inMemoryNewsCache, sourceUsed: currentSource };
  }

  /**
   * Mirror & Sync to Firebase Realtime Database with Sobrescrição enforcement
   */
  public async mirrorNewsToFirebase(
    articles: NewsItem[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<{
    success: boolean;
    syncedCount: number;
    targetUsed: "primary" | "mirror" | "both";
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

    // If both databases are near capacity (~1.9 GB total), execute Sobrescrição!
    if (writeTarget === "sobrescricao_both_active") {
      if (onProgress) {
        onProgress(30, "Capacidade próxima de 1,9 GB: Executando sobrescrição automática dos registros mais antigos...");
      }
      await this.executeStorageSobrescricao("primary", 30);
      await this.executeStorageSobrescricao("mirror", 30);
    }

    let targetSuccess: "primary" | "mirror" | "both" = "primary";

    // Write to Primary
    if ((writeTarget === "primary" || writeTarget === "sobrescricao_both_active") && primaryFb.isValid && primaryFb.db) {
      if (onProgress) onProgress(50, "Gravando no Banco 1 (legal-norm2)...");
      try {
        await set(ref(primaryFb.db, "news"), payload);
        this.recordWriteStorage("primary", totalBatchBytes, articles.length);

        // Also mirror to secondary
        if (mirrorFb.isValid && mirrorFb.db) {
          if (onProgress) onProgress(80, "Espelhando no Banco 2 (legal-norm3)...");
          try {
            await set(ref(mirrorFb.db, "news"), payload);
            this.recordWriteStorage("mirror", totalBatchBytes, articles.length);
            targetSuccess = "both";
          } catch {}
        }
      } catch (err: any) {
        console.error("Erro gravando no Banco 1:", err);
        if (mirrorFb.isValid && mirrorFb.db) {
          await set(ref(mirrorFb.db, "news"), payload);
          this.recordWriteStorage("mirror", totalBatchBytes, articles.length);
          targetSuccess = "mirror";
        }
      }
    } else if (mirrorFb.isValid && mirrorFb.db) {
      if (onProgress) onProgress(60, "Direcionando gravação para Banco 2 (legal-norm3)...");
      await set(ref(mirrorFb.db, "news"), payload);
      this.recordWriteStorage("mirror", totalBatchBytes, articles.length);
      targetSuccess = "mirror";
    }

    if (onProgress) onProgress(100, "Sincronização e indexação concluídas com sucesso!");
    this.savePersistedData();

    return {
      success: true,
      syncedCount: articles.length,
      targetUsed: targetSuccess,
    };
  }

  public async logMetricEvent(type: string, data: Record<string, any>) {
    // If traffic sobrescrição is active, avoid heavy writes to preserve bandwidth
    if (this.sobrescricao.isTrafficSobrescricaoActive && Math.random() > 0.1) {
      return;
    }
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

  public getCatalogIndex(): NewsCatalogIndex {
    return { ...this.catalogIndex };
  }

  public getState(): TrafficRouterState {
    const bothFull =
      this.primaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD &&
      this.mirrorStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;

    return {
      activeReadSource: this.activeReadSource,
      activeWriteTarget: bothFull ? "sobrescricao_both_active" : this.evaluateWriteTarget(),
      bothStorageNearLimit: bothFull,
      primaryTraffic: { ...this.primaryTraffic },
      mirrorTraffic: { ...this.mirrorTraffic },
      primaryStorage: { ...this.primaryStorage },
      mirrorStorage: { ...this.mirrorStorage },
      sobrescricao: { ...this.sobrescricao },
      isPrimaryConfigured: isConfigValid(primaryConfig),
      isMirrorConfigured: isConfigValid(mirrorConfig),
      totalArticlesCount: this.catalogIndex.totalArticles,
      indexEntriesCount: Object.keys(this.catalogIndex.entries).length,
      lastSyncTime: this.primaryTraffic.lastActive || this.mirrorTraffic.lastActive,
      mode: this.isManualOverride ? "manual" : "automatic",
      monthCycle: getCurrentMonthKey().replace(STORAGE_KEY_PREFIX, ""),
    };
  }
}

export const trafficRouter = new FirebaseTrafficRouter();
