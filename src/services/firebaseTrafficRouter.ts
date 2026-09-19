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
  getTertiaryFirebase,
  isConfigValid,
  primaryConfig,
  mirrorConfig,
  tertiaryConfig,
} from "./firebaseConfig";
import { NewsItem } from "../types";
import { NEWS_API_CONFIG } from "./newsApiConfig";

export type TrafficSource = "primary" | "mirror" | "tertiary" | "api";
export type StorageTarget = "primary" | "mirror" | "tertiary" | "all";

// Operational Limits: ~2.8 GB Storage (+0.9 GB proporcional) & ~29.4 GB Traffic (+9.8 GB proporcional)
export const TOTAL_STORAGE_LIMIT_BYTES = parseInt(import.meta.env.VITE_FIREBASE_STORAGE_LIMIT_BYTES || "3006477107", 10);
export const PER_DB_STORAGE_THRESHOLD = Math.floor(TOTAL_STORAGE_LIMIT_BYTES / 3) - (15 * 1024 * 1024); // ~950 MB / 0.9 GB per instance
export const ONE_GB_IN_BYTES = 1024 * 1024 * 1024;
export const NINE_FIFTY_MB_IN_BYTES = PER_DB_STORAGE_THRESHOLD;

export const TOTAL_TRAFFIC_LIMIT_BYTES = parseInt(import.meta.env.VITE_FIREBASE_TRAFFIC_LIMIT_BYTES || "31568007987", 10);
export const PER_DB_TRAFFIC_THRESHOLD = Math.floor(TOTAL_TRAFFIC_LIMIT_BYTES / 3) - (200 * 1024 * 1024); // ~9.8 GB per instance
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
  tertiaryCount: number;
  primaryStorageBytes: number;
  mirrorStorageBytes: number;
  tertiaryStorageBytes: number;
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
  activeWriteTarget: "primary" | "mirror" | "tertiary" | "sobrescricao_all_active";
  bothStorageNearLimit: boolean;
  allStorageNearLimit: boolean;
  primaryTraffic: ProjectBandwidthStats;
  mirrorTraffic: ProjectBandwidthStats;
  tertiaryTraffic: ProjectBandwidthStats;
  primaryStorage: ProjectStorageStats;
  mirrorStorage: ProjectStorageStats;
  tertiaryStorage: ProjectStorageStats;
  sobrescricao: SobrescricaoState;
  isPrimaryConfigured: boolean;
  isMirrorConfigured: boolean;
  isTertiaryConfigured: boolean;
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

  private tertiaryTraffic: ProjectBandwidthStats = {
    bytesUsed: 0,
    limitBytes: TEN_GB_IN_BYTES,
    thresholdBytes: PER_DB_TRAFFIC_THRESHOLD,
    requestCount: 0,
    errorCount: 0,
    lastActive: null,
  };

  // Storage Space Tracking (~2.8 GB total: 950 MB per instance)
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

  private tertiaryStorage: ProjectStorageStats = {
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
    tertiaryCount: 0,
    primaryStorageBytes: 4757104,
    mirrorStorageBytes: 0,
    tertiaryStorageBytes: 0,
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
        if (parsed.tertiaryTraffic) this.tertiaryTraffic = { ...this.tertiaryTraffic, ...parsed.tertiaryTraffic };
        if (parsed.activeReadSource && !this.isManualOverride) {
          this.activeReadSource = parsed.activeReadSource;
        }
      }

      const rawStorage = localStorage.getItem("nj_rtdb_storage_stats_v3");
      if (rawStorage) {
        const parsed = JSON.parse(rawStorage);
        if (parsed.primaryStorage) this.primaryStorage = { ...this.primaryStorage, ...parsed.primaryStorage };
        if (parsed.mirrorStorage) this.mirrorStorage = { ...this.mirrorStorage, ...parsed.mirrorStorage };
        if (parsed.tertiaryStorage) this.tertiaryStorage = { ...this.tertiaryStorage, ...parsed.tertiaryStorage };
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
          this.catalogIndex.tertiaryCount = parsed.tertiaryCount || 0;
          this.catalogIndex.primaryStorageBytes = parsed.primaryStorageBytes || this.primaryStorage.bytesUsed;
          this.catalogIndex.mirrorStorageBytes = parsed.mirrorStorageBytes || this.mirrorStorage.bytesUsed;
          this.catalogIndex.tertiaryStorageBytes = parsed.tertiaryStorageBytes || this.tertiaryStorage.bytesUsed;
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
          tertiaryTraffic: this.tertiaryTraffic,
          activeReadSource: this.activeReadSource,
          updatedAt: new Date().toISOString(),
        })
      );

      localStorage.setItem(
        "nj_rtdb_storage_stats_v3",
        JSON.stringify({
          primaryStorage: this.primaryStorage,
          mirrorStorage: this.mirrorStorage,
          tertiaryStorage: this.tertiaryStorage,
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

  private mergeNewsItems(existing: NewsItem[], incoming: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    const result: NewsItem[] = [];
    for (const item of incoming) {
      if (!item) continue;
      const key = String(item.link || item.id || item.slug || item.title);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    for (const item of existing) {
      if (!item) continue;
      const key = String(item.link || item.id || item.slug || item.title);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  }

  private notifyNewsSubscribers(items: NewsItem[]) {
    if (!items || items.length === 0) return;
    // Se a lista recebida for menor que a em memória, mescla para nunca perder matérias
    const merged = this.inMemoryNewsCache.length > items.length
      ? this.mergeNewsItems(this.inMemoryNewsCache, items)
      : items;

    const sig = `${merged.length}_${merged[0]?.id || ""}_${merged[0]?.slug || ""}`;
    if (sig === this.lastKnownSignature) return;
    this.lastKnownSignature = sig;
    this.inMemoryNewsCache = merged;

    this.newsSubscribers.forEach((cb) => {
      try {
        cb(merged);
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
   * Evaluates Storage Target and Sobrescrição Trigger (~2.8 GB total)
   * 1. If Banco 1 < 950MB -> routes to Primary (legal-norm2)
   * 2. If Banco 1 >= 950MB and Banco 2 < 950MB -> routes to Mirror (legal-norm3)
   * 3. If Banco 1 & 2 >= 950MB and Banco 3 < 950MB -> routes to Tertiary (legal-norm1)
   * 4. If ALL near 950MB (~2.8GB total) -> activates Sobrescrição (FIFO overwrite)
   */
  public evaluateWriteTarget(): "primary" | "mirror" | "tertiary" | "sobrescricao_all_active" {
    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();
    const tertiaryFb = getTertiaryFirebase();

    this.primaryStorage.isNearLimit = this.primaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;
    this.mirrorStorage.isNearLimit = this.mirrorStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;
    this.tertiaryStorage.isNearLimit = this.tertiaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;

    if (this.primaryStorage.isNearLimit && this.mirrorStorage.isNearLimit && this.tertiaryStorage.isNearLimit) {
      return "sobrescricao_all_active";
    }

    if (primaryFb.isValid && !this.primaryStorage.isNearLimit) {
      return "primary";
    }

    if (mirrorFb.isValid && !this.mirrorStorage.isNearLimit) {
      return "mirror";
    }

    if (tertiaryFb.isValid && !this.tertiaryStorage.isNearLimit) {
      return "tertiary";
    }

    return "primary";
  }

  /**
   * Evaluates Traffic Download Bandwidth Routing (~29.4 GB total across 3 instances)
   * 1. If Banco 1 < 9.8 GB -> routes to Primary
   * 2. If Banco 1 >= 9.8 GB and Banco 2 < 9.8 GB -> routes to Mirror
   * 3. If Banco 1 & 2 >= 9.8 GB and Banco 3 < 9.8 GB -> routes to Tertiary
   * 4. If ALL near 9.8 GB (~29.4 GB total) -> activates Traffic Sobrescrição
   */
  public evaluateReadRouting(): TrafficSource {
    if (this.isManualOverride) {
      return this.activeReadSource;
    }

    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();
    const tertiaryFb = getTertiaryFirebase();

    const primaryBytes = this.primaryTraffic.bytesUsed;
    const mirrorBytes = this.mirrorTraffic.bytesUsed;
    const tertiaryBytes = this.tertiaryTraffic.bytesUsed;

    if (primaryFb.isValid && primaryBytes < PER_DB_TRAFFIC_THRESHOLD) {
      this.activeReadSource = "primary";
    } else if (mirrorFb.isValid && mirrorBytes < PER_DB_TRAFFIC_THRESHOLD) {
      this.activeReadSource = "mirror";
    } else if (tertiaryFb.isValid && tertiaryBytes < PER_DB_TRAFFIC_THRESHOLD) {
      this.activeReadSource = "tertiary";
    } else if (primaryBytes + mirrorBytes + tertiaryBytes >= TOTAL_TRAFFIC_LIMIT_BYTES * 0.95) {
      // Traffic Sobrescrição mode: use in-memory cache and least utilized instance
      this.sobrescricao.isTrafficSobrescricaoActive = true;
      this.sobrescricao.trafficSobrescricaoCount++;
      this.sobrescricao.lastSobrescricaoAt = new Date().toISOString();
      const minBytes = Math.min(primaryBytes, mirrorBytes, tertiaryBytes);
      if (minBytes === primaryBytes) this.activeReadSource = "primary";
      else if (minBytes === mirrorBytes) this.activeReadSource = "mirror";
      else this.activeReadSource = "tertiary";
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
    } else if (source === "tertiary") {
      this.tertiaryTraffic.requestCount++;
      this.tertiaryTraffic.bytesUsed += bytes;
      this.tertiaryTraffic.lastActive = now;
      if (hasError) this.tertiaryTraffic.errorCount++;
    }
    this.savePersistedData();

    if (
      (source === "primary" && this.primaryTraffic.bytesUsed >= PER_DB_TRAFFIC_THRESHOLD) ||
      (source === "mirror" && this.mirrorTraffic.bytesUsed >= PER_DB_TRAFFIC_THRESHOLD) ||
      (source === "tertiary" && this.tertiaryTraffic.bytesUsed >= PER_DB_TRAFFIC_THRESHOLD)
    ) {
      this.evaluateReadRouting();
    }
  }

  private recordWriteStorage(target: "primary" | "mirror" | "tertiary", bytes: number, countDelta: number = 1) {
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
    } else if (target === "tertiary") {
      this.tertiaryStorage.bytesUsed += bytes;
      this.tertiaryStorage.articleCount += countDelta;
      this.tertiaryStorage.lastWrite = now;
      this.tertiaryStorage.isNearLimit = this.tertiaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;
      this.catalogIndex.tertiaryStorageBytes = this.tertiaryStorage.bytesUsed;
      this.catalogIndex.tertiaryCount += countDelta;
    }
    this.catalogIndex.updatedAt = now;
    this.savePersistedData();
  }

  /**
   * Executes Storage Sobrescrição (FIFO overwrite of oldest news)
   * When capacity reaches ~2.8 GB, prunes oldest articles to accept new ones seamlessly.
   */
  public async executeStorageSobrescricao(
    target: "primary" | "mirror" | "tertiary",
    articlesToPruneCount: number = 25
  ): Promise<{ prunedCount: number; bytesFreed: number }> {
    const fb =
      target === "tertiary"
        ? getTertiaryFirebase()
        : target === "mirror"
        ? getMirrorFirebase()
        : getPrimaryFirebase();
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
      } else if (target === "mirror") {
        this.mirrorStorage.bytesUsed = Math.max(0, this.mirrorStorage.bytesUsed - bytesFreed);
        this.mirrorStorage.articleCount = Math.max(0, this.mirrorStorage.articleCount - prunedCount);
        this.catalogIndex.mirrorStorageBytes = this.mirrorStorage.bytesUsed;
        this.catalogIndex.mirrorCount = this.mirrorStorage.articleCount;
      } else {
        this.tertiaryStorage.bytesUsed = Math.max(0, this.tertiaryStorage.bytesUsed - bytesFreed);
        this.tertiaryStorage.articleCount = Math.max(0, this.tertiaryStorage.articleCount - prunedCount);
        this.catalogIndex.tertiaryStorageBytes = this.tertiaryStorage.bytesUsed;
        this.catalogIndex.tertiaryCount = this.tertiaryStorage.articleCount;
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
   * Exclusively queries RTDB (Primary, Mirror, or Tertiary) without static JSON!
   */
  public async fetchNews(): Promise<{ news: NewsItem[]; sourceUsed: TrafficSource }> {
    // 1. Sempre prioriza a API do servidor (/api/news?all=true) com o catálogo completo de todas as fontes
    try {
      const serverRes = await fetch("/api/news?all=true");
      if (serverRes.ok) {
        const json = await serverRes.json();
        const items = json.data || json;
        if (Array.isArray(items) && items.length > 0) {
          const merged = this.mergeNewsItems(this.inMemoryNewsCache, items);
          this.inMemoryNewsCache = merged;
          return { news: merged, sourceUsed: "api" };
        }
      }
    } catch {}

    const currentSource = this.evaluateReadRouting();

    // 2. Try Firebase Web SDK from active instance
    try {
      const fbInstance =
        currentSource === "tertiary"
          ? getTertiaryFirebase()
          : currentSource === "mirror"
          ? getMirrorFirebase()
          : getPrimaryFirebase();
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
            const merged = this.mergeNewsItems(this.inMemoryNewsCache, items);
            this.inMemoryNewsCache = merged;
            try {
              sessionStorage.setItem(CACHE_NEWS_KEY, JSON.stringify(merged.slice(0, 100)));
            } catch {}
            return { news: merged, sourceUsed: currentSource };
          }
        }
      }
    } catch (err: any) {
      console.warn(`[RTDB Fetch] Erro via Web SDK (${currentSource}):`, err?.message || err);
      this.recordReadBandwidth(currentSource, 256, true);
    }

    // 3. Direct REST Fetch to Realtime Database endpoint
    try {
      const rtdbUrl =
        currentSource === "tertiary" && tertiaryConfig.databaseURL
          ? `${tertiaryConfig.databaseURL}/news.json`
          : currentSource === "mirror" && mirrorConfig.databaseURL
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
            const merged = this.mergeNewsItems(this.inMemoryNewsCache, items);
            this.inMemoryNewsCache = merged;
            return { news: merged, sourceUsed: currentSource };
          }
        }
      }
    } catch (err) {
      console.warn(`[RTDB Fetch] REST fallback failed:`, err);
    }

    // Return in-memory cache if available
    return { news: this.inMemoryNewsCache, sourceUsed: currentSource };
  }

  /**
   * Mirror & Sync to Firebase Realtime Database with Sobrescrição enforcement across 3 instances
   */
  public async mirrorNewsToFirebase(
    articles: NewsItem[],
    onProgress?: (progress: number, message: string) => void
  ): Promise<{
    success: boolean;
    syncedCount: number;
    targetUsed: "primary" | "mirror" | "tertiary" | "all";
    warning?: string;
  }> {
    const primaryFb = getPrimaryFirebase();
    const mirrorFb = getMirrorFirebase();
    const tertiaryFb = getTertiaryFirebase();

    if (!primaryFb.isValid && !mirrorFb.isValid && !tertiaryFb.isValid) {
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

    // If all three databases are near capacity (~2.8 GB total), execute Sobrescrição!
    if (writeTarget === "sobrescricao_all_active") {
      if (onProgress) {
        onProgress(30, "Capacidade próxima de 2,8 GB: Executando sobrescrição automática dos registros mais antigos...");
      }
      await this.executeStorageSobrescricao("primary", 30);
      await this.executeStorageSobrescricao("mirror", 30);
      await this.executeStorageSobrescricao("tertiary", 30);
    }

    let targetSuccess: "primary" | "mirror" | "tertiary" | "all" = "primary";

    // Write to Primary (legal-norm2)
    if (primaryFb.isValid && primaryFb.db) {
      if (onProgress) onProgress(40, "Gravando no Banco 1 (legal-norm2)...");
      try {
        await set(ref(primaryFb.db, "news"), payload);
        this.recordWriteStorage("primary", totalBatchBytes, articles.length);
      } catch (err) {
        console.warn("Erro gravando no Banco 1:", err);
      }
    }

    // Mirror to Secondary (legal-norm3)
    if (mirrorFb.isValid && mirrorFb.db) {
      if (onProgress) onProgress(65, "Espelhando no Banco 2 (legal-norm3)...");
      try {
        await set(ref(mirrorFb.db, "news"), payload);
        this.recordWriteStorage("mirror", totalBatchBytes, articles.length);
      } catch (err) {
        console.warn("Erro espelhando no Banco 2:", err);
      }
    }

    // Mirror to Tertiary (legal-norm1)
    if (tertiaryFb.isValid && tertiaryFb.db) {
      if (onProgress) onProgress(85, "Espelhando no Banco 3 (legal-norm1)...");
      try {
        await set(ref(tertiaryFb.db, "news"), payload);
        this.recordWriteStorage("tertiary", totalBatchBytes, articles.length);
        targetSuccess = "all";
      } catch (err) {
        console.warn("Erro espelhando no Banco 3:", err);
      }
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
    const allFull =
      this.primaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD &&
      this.mirrorStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD &&
      this.tertiaryStorage.bytesUsed >= PER_DB_STORAGE_THRESHOLD;

    return {
      activeReadSource: this.activeReadSource,
      activeWriteTarget: allFull ? "sobrescricao_all_active" : this.evaluateWriteTarget(),
      bothStorageNearLimit: allFull || (this.primaryStorage.isNearLimit && this.mirrorStorage.isNearLimit),
      allStorageNearLimit: allFull,
      primaryTraffic: { ...this.primaryTraffic },
      mirrorTraffic: { ...this.mirrorTraffic },
      tertiaryTraffic: { ...this.tertiaryTraffic },
      primaryStorage: { ...this.primaryStorage },
      mirrorStorage: { ...this.mirrorStorage },
      tertiaryStorage: { ...this.tertiaryStorage },
      sobrescricao: { ...this.sobrescricao },
      isPrimaryConfigured: isConfigValid(primaryConfig),
      isMirrorConfigured: isConfigValid(mirrorConfig),
      isTertiaryConfigured: isConfigValid(tertiaryConfig),
      totalArticlesCount: this.catalogIndex.totalArticles,
      indexEntriesCount: Object.keys(this.catalogIndex.entries).length,
      lastSyncTime:
        this.primaryTraffic.lastActive || this.mirrorTraffic.lastActive || this.tertiaryTraffic.lastActive,
      mode: this.isManualOverride ? "manual" : "automatic",
      monthCycle: getCurrentMonthKey().replace(STORAGE_KEY_PREFIX, ""),
    };
  }
}

export const trafficRouter = new FirebaseTrafficRouter();
