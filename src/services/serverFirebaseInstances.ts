import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface ServiceAccountCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
  private_key_id?: string;
  client_id?: string;
}

export type FirebaseInstanceId = "primary" | "mirror" | "tertiary";

export interface InstanceQuotaConfig {
  id: FirebaseInstanceId;
  name: string;
  projectId: string;
  databaseUrl: string;
  serviceAccountPath: string;
  storageLimitBytes: number;     // 1 GB = 1,073,741,824 bytes
  storageThresholdBytes: number; // 950 MB
  trafficLimitBytes: number;     // 10 GB = 10,737,418,240 bytes
  trafficThresholdBytes: number; // 9.5 GB
}

export interface InstanceStats {
  id: FirebaseInstanceId;
  name: string;
  projectId: string;
  databaseUrl: string;
  storageBytesUsed: number;
  storageLimitBytes: number;
  storageThresholdBytes: number;
  articleCount: number;
  isStorageNearLimit: boolean;
  trafficBytesUsed: number;
  trafficLimitBytes: number;
  trafficThresholdBytes: number;
  isTrafficNearLimit: boolean;
  requestCount: number;
  errorCount: number;
  lastActive: string | null;
  lastWrite: string | null;
  lastSobrescricao: string | null;
  sobrescricaoCount: number;
  status: "healthy" | "warning" | "quota_exceeded" | "offline";
}

export interface MultiInstanceSummary {
  monthCycle: string;
  activeReadInstance: FirebaseInstanceId;
  activeWriteInstance: FirebaseInstanceId;
  totalStorageBytesUsed: number;
  totalStorageLimitBytes: number; // 3 GB
  totalTrafficBytesUsed: number;
  totalTrafficLimitBytes: number; // 30 GB
  storageUsagePercent: number;
  trafficUsagePercent: number;
  isGlobalStorageNearLimit: boolean;
  isGlobalTrafficNearLimit: boolean;
  instances: Record<FirebaseInstanceId, InstanceStats>;
}

// Global Constants: 1 GB & 10 GB per instance; 3 GB & 30 GB total across the 3 instances
export const ONE_GB = 1024 * 1024 * 1024;
export const NINE_FIFTY_MB = Math.floor(ONE_GB * 0.93); // ~950 MB
export const TEN_GB = 10 * 1024 * 1024 * 1024;
export const NINE_POINT_FIVE_GB = Math.floor(TEN_GB * 0.95); // ~9.5 GB

export const THREE_GB_TOTAL = 3 * ONE_GB;
export const THIRTY_GB_TOTAL = 3 * TEN_GB;

const INSTANCE_CONFIGS: Record<FirebaseInstanceId, InstanceQuotaConfig> = {
  primary: {
    id: "primary",
    name: "Banco 1 • legal-norm2",
    projectId: "legal-norm2",
    databaseUrl: "https://legal-norm2-default-rtdb.firebaseio.com",
    serviceAccountPath: "server-secrets/serviceAccount-legal-norm2.json",
    storageLimitBytes: ONE_GB,
    storageThresholdBytes: NINE_FIFTY_MB,
    trafficLimitBytes: TEN_GB,
    trafficThresholdBytes: NINE_POINT_FIVE_GB,
  },
  mirror: {
    id: "mirror",
    name: "Banco 2 • legal-norm3",
    projectId: "legal-norm3",
    databaseUrl: "https://legal-norm3-default-rtdb.firebaseio.com",
    serviceAccountPath: "server-secrets/serviceAccount-legal-norm3.json",
    storageLimitBytes: ONE_GB,
    storageThresholdBytes: NINE_FIFTY_MB,
    trafficLimitBytes: TEN_GB,
    trafficThresholdBytes: NINE_POINT_FIVE_GB,
  },
  tertiary: {
    id: "tertiary",
    name: "Banco 3 • legal-norm1",
    projectId: "legal-norm1",
    databaseUrl: "https://legal-norm1-default-rtdb.firebaseio.com",
    serviceAccountPath: "server-secrets/serviceAccount-legal-norm1.json",
    storageLimitBytes: ONE_GB,
    storageThresholdBytes: NINE_FIFTY_MB,
    trafficLimitBytes: TEN_GB,
    trafficThresholdBytes: NINE_POINT_FIVE_GB,
  },
};

interface TokenCache {
  token: string;
  expiresAt: number;
}

export class ServerFirebaseManager {
  private static instance: ServerFirebaseManager;
  private tokens: Map<FirebaseInstanceId, TokenCache> = new Map();
  private stats: Record<FirebaseInstanceId, InstanceStats>;
  private activeRead: FirebaseInstanceId = "primary";
  private activeWrite: FirebaseInstanceId = "primary";
  private statsFilePath: string;

  private constructor() {
    this.statsFilePath = path.resolve(process.cwd(), "src/data/firebaseTrafficStats.json");
    this.stats = this.loadStats();
    this.ensureStatsCurrentMonth();
  }

  public static getInstance(): ServerFirebaseManager {
    if (!ServerFirebaseManager.instance) {
      ServerFirebaseManager.instance = new ServerFirebaseManager();
    }
    return ServerFirebaseManager.instance;
  }

  private getCurrentMonthKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  private loadStats(): Record<FirebaseInstanceId, InstanceStats> {
    const defaultStats: Record<FirebaseInstanceId, InstanceStats> = {
      primary: {
        id: "primary",
        name: INSTANCE_CONFIGS.primary.name,
        projectId: INSTANCE_CONFIGS.primary.projectId,
        databaseUrl: INSTANCE_CONFIGS.primary.databaseUrl,
        storageBytesUsed: 0,
        storageLimitBytes: ONE_GB,
        storageThresholdBytes: NINE_FIFTY_MB,
        articleCount: 0,
        isStorageNearLimit: false,
        trafficBytesUsed: 0,
        trafficLimitBytes: TEN_GB,
        trafficThresholdBytes: NINE_POINT_FIVE_GB,
        isTrafficNearLimit: false,
        requestCount: 0,
        errorCount: 0,
        lastActive: null,
        lastWrite: null,
        lastSobrescricao: null,
        sobrescricaoCount: 0,
        status: "healthy",
      },
      mirror: {
        id: "mirror",
        name: INSTANCE_CONFIGS.mirror.name,
        projectId: INSTANCE_CONFIGS.mirror.projectId,
        databaseUrl: INSTANCE_CONFIGS.mirror.databaseUrl,
        storageBytesUsed: 0,
        storageLimitBytes: ONE_GB,
        storageThresholdBytes: NINE_FIFTY_MB,
        articleCount: 0,
        isStorageNearLimit: false,
        trafficBytesUsed: 0,
        trafficLimitBytes: TEN_GB,
        trafficThresholdBytes: NINE_POINT_FIVE_GB,
        isTrafficNearLimit: false,
        requestCount: 0,
        errorCount: 0,
        lastActive: null,
        lastWrite: null,
        lastSobrescricao: null,
        sobrescricaoCount: 0,
        status: "healthy",
      },
      tertiary: {
        id: "tertiary",
        name: INSTANCE_CONFIGS.tertiary.name,
        projectId: INSTANCE_CONFIGS.tertiary.projectId,
        databaseUrl: INSTANCE_CONFIGS.tertiary.databaseUrl,
        storageBytesUsed: 0,
        storageLimitBytes: ONE_GB,
        storageThresholdBytes: NINE_FIFTY_MB,
        articleCount: 0,
        isStorageNearLimit: false,
        trafficBytesUsed: 0,
        trafficLimitBytes: TEN_GB,
        trafficThresholdBytes: NINE_POINT_FIVE_GB,
        isTrafficNearLimit: false,
        requestCount: 0,
        errorCount: 0,
        lastActive: null,
        lastWrite: null,
        lastSobrescricao: null,
        sobrescricaoCount: 0,
        status: "healthy",
      },
    };

    try {
      if (fs.existsSync(this.statsFilePath)) {
        const raw = fs.readFileSync(this.statsFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.instances) {
          const mKey = this.getCurrentMonthKey();
          if (parsed.monthCycle === mKey) {
            return {
              ...defaultStats,
              ...parsed.instances,
            };
          }
        }
      }
    } catch {}

    return defaultStats;
  }

  private saveStats(): void {
    try {
      const dir = path.dirname(this.statsFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const payload = {
        monthCycle: this.getCurrentMonthKey(),
        updatedAt: new Date().toISOString(),
        instances: this.stats,
      };
      fs.writeFileSync(this.statsFilePath, JSON.stringify(payload, null, 2), "utf-8");
    } catch {}
  }

  private ensureStatsCurrentMonth(): void {
    const current = this.getCurrentMonthKey();
    let resetNeeded = false;
    try {
      if (fs.existsSync(this.statsFilePath)) {
        const raw = fs.readFileSync(this.statsFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.monthCycle !== current) {
          resetNeeded = true;
        }
      }
    } catch {
      resetNeeded = true;
    }

    if (resetNeeded) {
      // Monthly rollover: reset traffic counters (quota renewal every month)
      for (const id of ["primary", "mirror", "tertiary"] as FirebaseInstanceId[]) {
        this.stats[id].trafficBytesUsed = 0;
        this.stats[id].requestCount = 0;
        this.stats[id].errorCount = 0;
        this.stats[id].isTrafficNearLimit = false;
      }
      this.saveStats();
    }
  }

  /**
   * Generates or returns a valid cached Google OAuth2 Bearer Access Token for the instance's service account.
   */
  public async getAccessToken(instanceId: FirebaseInstanceId): Promise<string | null> {
    const cached = this.tokens.get(instanceId);
    const now = Math.floor(Date.now() / 1000);

    if (cached && cached.expiresAt > now + 120) {
      return cached.token;
    }

    const cfg = INSTANCE_CONFIGS[instanceId];
    const saPath = path.resolve(process.cwd(), cfg.serviceAccountPath);

    let sa: ServiceAccountCredentials | null = null;

    if (fs.existsSync(saPath)) {
      try {
        sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
      } catch (err: any) {
        console.warn(`[Firebase Instances] Erro ao ler arquivo ${saPath}:`, err?.message || err);
      }
    }

    if (!sa) {
      // Tentar variáveis de ambiente para deploy seguro em CI/CD e GitHub/Vercel
      const envKeyMap: Record<FirebaseInstanceId, string[]> = {
        primary: [
          "FIREBASE_SERVICE_ACCOUNT_LEGAL_NORM2",
          "FIREBASE_SERVICE_ACCOUNT_PRIMARY",
          "FIREBASE_SERVICE_ACCOUNT_JSON",
        ],
        mirror: [
          "FIREBASE_SERVICE_ACCOUNT_LEGAL_NORM3",
          "FIREBASE_SERVICE_ACCOUNT_MIRROR",
        ],
        tertiary: [
          "FIREBASE_SERVICE_ACCOUNT_LEGAL_NORM1",
          "FIREBASE_SERVICE_ACCOUNT_TERTIARY",
        ],
      };

      for (const envVar of envKeyMap[instanceId]) {
        const val = process.env[envVar];
        if (val) {
          try {
            sa = JSON.parse(val.startsWith("{") ? val : Buffer.from(val, "base64").toString("utf-8"));
            break;
          } catch {}
        }
      }
    }

    if (!sa || !sa.client_email || !sa.private_key) {
      console.warn(`[Firebase Instances] Credenciais da conta de serviço não encontradas para ${instanceId}`);
      return null;
    }

    try {
      const header = { alg: "RS256", typ: "JWT" };
      const claim = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      };

      const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
      const unsigned = `${b64(header)}.${b64(claim)}`;
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(unsigned);
      const signature = sign.sign(sa.private_key, "base64url");
      const jwt = `${unsigned}.${signature}`;

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      });

      if (!res.ok) {
        console.warn(`[Firebase Instances] Failed to obtain OAuth2 token for ${instanceId}:`, res.status);
        return null;
      }

      const data = await res.json();
      if (data && data.access_token) {
        this.tokens.set(instanceId, {
          token: data.access_token,
          expiresAt: now + (data.expires_in || 3600),
        });
        return data.access_token;
      }
    } catch (err: any) {
      console.warn(`[Firebase Instances] Token generation exception for ${instanceId}:`, err?.message || err);
    }
    return null;
  }

  /**
   * Tracks bandwidth traffic bytes sent/received for a given instance.
   */
  public trackTraffic(instanceId: FirebaseInstanceId, bytes: number): void {
    const s = this.stats[instanceId];
    if (!s) return;

    s.trafficBytesUsed += bytes;
    s.requestCount += 1;
    s.lastActive = new Date().toISOString();

    if (s.trafficBytesUsed >= s.trafficThresholdBytes) {
      s.isTrafficNearLimit = true;
      s.status = "warning";
      this.rebalanceTrafficRotation();
    }
    if (s.trafficBytesUsed >= s.trafficLimitBytes) {
      s.status = "quota_exceeded";
      this.rebalanceTrafficRotation();
    }

    this.saveStats();
  }

  /**
   * Determines and rotates the healthiest instance for next read/write.
   */
  private rebalanceTrafficRotation(): void {
    const ids: FirebaseInstanceId[] = ["primary", "mirror", "tertiary"];
    // Prefer instance with lowest traffic usage
    ids.sort((a, b) => this.stats[a].trafficBytesUsed - this.stats[b].trafficBytesUsed);
    if (ids[0] && this.stats[ids[0]].trafficBytesUsed < TEN_GB) {
      this.activeRead = ids[0];
    }

    // Prefer instance with lowest storage usage for write
    const writeIds: FirebaseInstanceId[] = ["primary", "mirror", "tertiary"];
    writeIds.sort((a, b) => this.stats[a].storageBytesUsed - this.stats[b].storageBytesUsed);
    if (writeIds[0] && this.stats[writeIds[0]].storageBytesUsed < ONE_GB) {
      this.activeWrite = writeIds[0];
    }
  }

  /**
   * Authenticated HTTP request to an instance's Realtime Database with traffic counting.
   */
  public async requestRtdb(
    instanceId: FirebaseInstanceId,
    endpointPath: string,
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: any
  ): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
    const cfg = INSTANCE_CONFIGS[instanceId];
    const token = await this.getAccessToken(instanceId);
    if (!token) {
      this.stats[instanceId].errorCount += 1;
      return { ok: false, status: 401, error: "Unable to authenticate with service account" };
    }

    const cleanPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
    const url = `${cfg.databaseUrl}${cleanPath}.json`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    let serializedBody: string | undefined;
    let requestBytes = 200; // estimated headers
    if (body !== undefined) {
      serializedBody = JSON.stringify(body);
      requestBytes += Buffer.byteLength(serializedBody, "utf-8");
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: serializedBody,
        signal: AbortSignal.timeout(60000),
      });

      const responseText = await res.text();
      const responseBytes = Buffer.byteLength(responseText, "utf-8") + 200;

      // Track total network traffic (request + response)
      this.trackTraffic(instanceId, requestBytes + responseBytes);

      if (!res.ok) {
        this.stats[instanceId].errorCount += 1;
        return { ok: false, status: res.status, error: responseText };
      }

      let parsedData: any = null;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        parsedData = responseText;
      }

      return { ok: true, status: res.status, data: parsedData };
    } catch (err: any) {
      this.stats[instanceId].errorCount += 1;
      return { ok: false, status: 500, error: err.message || String(err) };
    }
  }

  /**
   * Writes news data to an instance and checks storage limits,
   * triggering automatic FIFO sobrescrição if storage approaches 950 MB.
   */
  public async writeNews(
    instanceId: FirebaseInstanceId,
    newsItems: any[]
  ): Promise<{ success: boolean; itemsCount: number; bytesStored: number; prunedCount?: number }> {
    const payloadBytes = Buffer.byteLength(JSON.stringify(newsItems), "utf-8");
    const cfg = INSTANCE_CONFIGS[instanceId];

    let itemsToWrite = [...newsItems];
    let prunedCount = 0;

    // Automatic FIFO Sobrescrição: If payload reaches threshold (950 MB), prune oldest items to guarantee 1 GB limit
    let currentBytes = payloadBytes;
    if (currentBytes >= cfg.storageThresholdBytes) {
      console.warn(
        `[Sobrescrição Server] Instância ${instanceId} atingiu limite de 950 MB (${currentBytes} bytes). Executando sobrescrição FIFO...`
      );
      while (currentBytes >= cfg.storageThresholdBytes * 0.9 && itemsToWrite.length > 50) {
        itemsToWrite.pop(); // Remove oldest
        prunedCount++;
        currentBytes = Buffer.byteLength(JSON.stringify(itemsToWrite), "utf-8");
      }
      this.stats[instanceId].sobrescricaoCount += 1;
      this.stats[instanceId].lastSobrescricao = new Date().toISOString();
    }

    const res = await this.requestRtdb(instanceId, "/news", "PUT", itemsToWrite);

    if (res.ok) {
      this.stats[instanceId].storageBytesUsed = currentBytes;
      this.stats[instanceId].articleCount = itemsToWrite.length;
      this.stats[instanceId].lastWrite = new Date().toISOString();
      this.stats[instanceId].isStorageNearLimit = currentBytes >= cfg.storageThresholdBytes;
      this.saveStats();
      this.rebalanceTrafficRotation();

      return {
        success: true,
        itemsCount: itemsToWrite.length,
        bytesStored: currentBytes,
        prunedCount,
      };
    }

    return {
      success: false,
      itemsCount: 0,
      bytesStored: 0,
    };
  }

  /**
   * Synchronizes news across all 3 instances in parallel with partition/mirror balancing.
   */
  public async syncAllInstances(newsItems: any[]): Promise<{
    primary: { success: boolean; count: number };
    mirror: { success: boolean; count: number };
    tertiary: { success: boolean; count: number };
  }> {
    const [resPrimary, resMirror, resTertiary] = await Promise.allSettled([
      this.writeNews("primary", newsItems),
      this.writeNews("mirror", newsItems),
      this.writeNews("tertiary", newsItems),
    ]);

    return {
      primary: {
        success: resPrimary.status === "fulfilled" && resPrimary.value.success,
        count: resPrimary.status === "fulfilled" ? resPrimary.value.itemsCount : 0,
      },
      mirror: {
        success: resMirror.status === "fulfilled" && resMirror.value.success,
        count: resMirror.status === "fulfilled" ? resMirror.value.itemsCount : 0,
      },
      tertiary: {
        success: resTertiary.status === "fulfilled" && resTertiary.value.success,
        count: resTertiary.status === "fulfilled" ? resTertiary.value.itemsCount : 0,
      },
    };
  }

  /**
   * Returns a complete multi-instance summary for admin metrics and traffic monitoring.
   */
  public getSummary(): MultiInstanceSummary {
    this.ensureStatsCurrentMonth();

    const totalStorageBytes =
      this.stats.primary.storageBytesUsed +
      this.stats.mirror.storageBytesUsed +
      this.stats.tertiary.storageBytesUsed;

    const totalTrafficBytes =
      this.stats.primary.trafficBytesUsed +
      this.stats.mirror.trafficBytesUsed +
      this.stats.tertiary.trafficBytesUsed;

    const isGlobalStorageNearLimit = totalStorageBytes >= THREE_GB_TOTAL * 0.95;
    const isGlobalTrafficNearLimit = totalTrafficBytes >= THIRTY_GB_TOTAL * 0.95;

    return {
      monthCycle: this.getCurrentMonthKey(),
      activeReadInstance: this.activeRead,
      activeWriteInstance: this.activeWrite,
      totalStorageBytesUsed: totalStorageBytes,
      totalStorageLimitBytes: THREE_GB_TOTAL,
      totalTrafficBytesUsed: totalTrafficBytes,
      totalTrafficLimitBytes: THIRTY_GB_TOTAL,
      storageUsagePercent: Math.min(100, Math.round((totalStorageBytes / THREE_GB_TOTAL) * 1000) / 10),
      trafficUsagePercent: Math.min(100, Math.round((totalTrafficBytes / THIRTY_GB_TOTAL) * 1000) / 10),
      isGlobalStorageNearLimit,
      isGlobalTrafficNearLimit,
      instances: { ...this.stats },
    };
  }

  /**
   * Manually rotate traffic to next instance.
   */
  public cycleReadInstance(): FirebaseInstanceId {
    const order: FirebaseInstanceId[] = ["primary", "mirror", "tertiary"];
    const nextIdx = (order.indexOf(this.activeRead) + 1) % order.length;
    this.activeRead = order[nextIdx];
    return this.activeRead;
  }
}

export const serverFirebaseManager = ServerFirebaseManager.getInstance();
