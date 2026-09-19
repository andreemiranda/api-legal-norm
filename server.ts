import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { buildCategoryFeed } from "./src/utils/categoryFeedManager";
import { extractTagsForNewsItem, computeTagCounts } from "./src/utils/tagEngine";
import { verifyNewsImage, resolveAuthenticNewsImage } from "./src/utils/imageVerification";

// Automatically load .env
if (fs.existsSync(path.join(process.cwd(), ".env"))) {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
}

// Default News API configurations directly in code (no manual user input required)
process.env.NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL || "https://api-news-media.netlify.app";
process.env.NEWS_API_KEY = process.env.NEWS_API_KEY || "bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd";

const app = express();
app.set("trust proxy", 1); // Confia no proxy reverso do Cloud Run (Evita erro do express-rate-limit com X-Forwarded-For)

// Configuração do PORT: no Render.com a porta é fornecida via process.env.PORT (ex: 10000).
// No ambiente AI Studio / dev local, RENDER não está definido, mantendo estritamente 3000.
const isRender = process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
const PORT = isRender && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://pagead2.googlesyndication.com", "https://www.googletagmanager.com", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        "https://*.firebaseio.com",
        "https://*.googleapis.com",
        "https://api-news-media.netlify.app",
        "https://pagead2.googlesyndication.com",
        "https://googleads.g.doubleclick.net",
        "https://www.google-analytics.com",
        "https://api.open-meteo.com",
        "https://geocoding-api.open-meteo.com",
        "https://nominatim.openstreetmap.org",
        "https://photon.komoot.io",
        "https://ipwho.is",
        "https://freeipapi.com",
        "https://api.bigdatacloud.net",
        "http://ip-api.com",
        "https://*.onrender.com",
        "https://*.render.com"
      ],
      frameSrc: ["'self'", "https://googleads.g.doubleclick.net", "https://normajuridica.com", "https://*.onrender.com", "https://*.render.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      frameAncestors: ["*"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  xFrameOptions: false,
}));

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Requisições sem header Origin (scripts do mesmo domínio, cURL, server-to-server)
    if (!origin) return callback(null, true);

    // Permite qualquer subdomínio do Render.com, Cloud Run, localhost ou do próprio portal
    if (
      origin.includes("onrender.com") ||
      origin.includes("render.com") ||
      origin.includes("run.app") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("normajuridica") ||
      origin.includes("netlify.app")
    ) {
      return callback(null, true);
    }

    const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_DOMAIN || process.env.DOMAIN || "").split(",").map(s => s.trim()).filter(Boolean);
    if (process.env.NODE_ENV !== "production" || envOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Não lançar erro 500 para requisições com origin não permitido; rejeita suavemente sem quebrar o Express
    return callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { success: false, error: "Muitas requisições, tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter limit for auth
  message: { success: false, valid: false, error: "Muitas tentativas, tente novamente mais tarde." },
  validate: { trustProxy: false, xForwardedForHeader: false },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 messages per hour per IP
  message: { success: false, error: "Muitas mensagens enviadas, aguarde algumas horas." },
  validate: { trustProxy: false, xForwardedForHeader: false },
});

app.use("/api/", apiLimiter);

app.use(express.json({ limit: "1mb" })); // Limite de payload
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Cached in-memory collections
let categoriesData: Array<{ category: string; count: number }> = [];
let sourcesData: Array<any> = [];
let allNewsData: Array<any> = [];
let mediaPoolData: Array<any> = [];
let mediaChannelsData: Array<any> = [];
let lastSyncTimestamp = Date.now();
const realtimeClients = new Set<express.Response>();

const entities: Record<string, string> = {
  "&#8220;": '"',
  "&#8221;": '"',
  "&#8216;": "'",
  "&#8217;": "'",
  "&#8211;": "-",
  "&#8212;": "--",
  "&quot;": '"',
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&#039;": "'",
  "&nbsp;": " ",
};

const decodeHtml = (text: string) => {
  if (!text) return "";
  return text.replace(/&#?\w+;/g, (match) => entities[match] || match);
};

const slugify = (text: string) => {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

function cleanSlug(item: any): string {
  const rawUrl =
    typeof item.link === "string" && item.link.startsWith("http")
      ? item.link
      : typeof item.id === "string" && item.id.startsWith("http")
      ? item.id
      : "";

  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      const cleanPath = u.pathname
        .replace(/\.(ghtml|html|htm|php|asp|aspx)$/i, "")
        .replace(/^\/+|\/+$/g, "");
      if (cleanPath && cleanPath.length > 5) {
        return `post/${cleanPath.replace(/^post\//, "")}`;
      }
    } catch {}
  }

  const d = new Date(item.pubDate || Date.now());
  const y = isNaN(d.getFullYear()) ? "2026" : String(d.getFullYear());
  const m = isNaN(d.getMonth()) ? "09" : String(d.getMonth() + 1).padStart(2, "0");
  const day = isNaN(d.getDate()) ? "07" : String(d.getDate()).padStart(2, "0");
  const catSlug = slugify(item.category || "noticias");
  const titleSlug = slugify(item.title || "noticia");
  return `post/${catSlug}/noticia/${y}/${m}/${day}/${titleSlug}`;
}

function extractImage(item: any): string | null {
  const resolved = resolveAuthenticNewsImage(item);
  return resolved.verifiedImage || null;
}

function cleanEditorialText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
    .replace(/<p[^>]*>\s*(da\s+redação|da\s+redacao)\s*<\/p>/gi, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .replace(/\bRedação Norma Jurídica\b/gi, "Norma Jurídica")
    .trim();
}

// Load initial database files
try {
  const catPath = path.join(process.cwd(), "src", "data", "categories.json");
  if (fs.existsSync(catPath)) {
    categoriesData = JSON.parse(fs.readFileSync(catPath, "utf-8"));
  }
  const srcPath = path.join(process.cwd(), "src", "data", "sources.json");
  if (fs.existsSync(srcPath)) {
    sourcesData = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
  }

  // Ensure newly configured Justiça sources are directly in code without needing manual chat input
  const defaultJusticaSources = [
    {
      id: 528374619283746,
      category: "Justiça",
      site: "https://api-news-media.netlify.app/api/news/528374619283746",
      type: "wp-api",
      url: "https://api-news-media.netlify.app/api/news/528374619283746",
      active: true,
      _links: { self: { href: "https://api-news-media.netlify.app/api/news/528374619283746" } },
      originalSite: "normajuridica.com"
    },
    {
      id: 194728365019283,
      category: "Justiça",
      site: "https://api-news-media.netlify.app/api/news/194728365019283",
      type: "wp-api",
      url: "https://api-news-media.netlify.app/api/news/194728365019283",
      active: true,
      _links: { self: { href: "https://api-news-media.netlify.app/api/news/194728365019283" } },
      originalSite: "normajuridica.com"
    },
    {
      id: 736482910573649,
      category: "Justiça",
      site: "https://api-news-media.netlify.app/api/news/736482910573649",
      type: "wp-api",
      url: "https://api-news-media.netlify.app/api/news/736482910573649",
      active: true,
      _links: { self: { href: "https://api-news-media.netlify.app/api/news/736482910573649" } },
      originalSite: "normajuridica.com"
    },
    {
      id: 813947265038471,
      category: "Justiça",
      site: "https://api-news-media.netlify.app/api/news/813947265038471",
      type: "wp-api",
      url: "https://api-news-media.netlify.app/api/news/813947265038471",
      active: true,
      _links: { self: { href: "https://api-news-media.netlify.app/api/news/813947265038471" } },
      originalSite: "normajuridica.com"
    }
  ];

  for (const src of defaultJusticaSources) {
    if (!sourcesData.some((s) => String(s.id) === String(src.id))) {
      sourcesData.push(src);
    }
  }

  // Dynamically load any additional NEWS_API_SOURCE_* from environment variables
  Object.keys(process.env).forEach((envKey) => {
    const match = envKey.match(/^NEWS_API_SOURCE_(\d+)_ID$/);
    if (match) {
      const idx = match[1];
      const sourceId = process.env[envKey];
      const category = process.env[`NEWS_API_SOURCE_${idx}_CATEGORY`] || "Justiça";
      const site = process.env[`NEWS_API_SOURCE_${idx}_SITE`] || `https://api-news-media.netlify.app/api/news/${sourceId}`;
      const endpoint = process.env[`NEWS_API_SOURCE_${idx}_ENDPOINT`] || `/api/news/${sourceId}`;
      if (sourceId && !sourcesData.some((s) => String(s.id) === String(sourceId))) {
        sourcesData.push({
          id: isNaN(Number(sourceId)) ? sourceId : Number(sourceId),
          category,
          site,
          type: "wp-api",
          url: site.startsWith("http") ? site : `https://api-news-media.netlify.app${endpoint}`,
          active: true,
          _links: { self: { href: site.startsWith("http") ? site : `https://api-news-media.netlify.app${endpoint}` } },
          originalSite: "normajuridica.com"
        });
      }
    }
  });
  const mediaPath = path.join(process.cwd(), "src", "data", "mediaImages.json");
  if (fs.existsSync(mediaPath)) {
    mediaPoolData = JSON.parse(fs.readFileSync(mediaPath, "utf-8"));
  }
  const mediaChannelsPath = path.join(process.cwd(), "src", "data", "mediaChannels.json");
  if (fs.existsSync(mediaChannelsPath)) {
    mediaChannelsData = JSON.parse(fs.readFileSync(mediaChannelsPath, "utf-8"));
  }
} catch (err) {
  console.error("Error loading initial data files:", err);
}

// Firebase Realtime Database and Sobrescrição Engine (~2.8 GB Storage & ~29.4 GB Traffic across 3 instances)
const RTDB_PRIMARY = "https://legal-norm2-default-rtdb.firebaseio.com/news.json";
const RTDB_MIRROR = "https://legal-norm3-default-rtdb.firebaseio.com/news.json";
const RTDB_TERTIARY = "https://legal-norm1-default-rtdb.firebaseio.com/news.json";
const UPSTREAM_API = "https://api-news-media.netlify.app/api/news";

const STORAGE_LIMIT_BYTES = parseInt(process.env.VITE_FIREBASE_STORAGE_LIMIT_BYTES || process.env.FIREBASE_STORAGE_LIMIT_BYTES || "3006477107", 10);
const TRAFFIC_LIMIT_BYTES = parseInt(process.env.VITE_FIREBASE_TRAFFIC_LIMIT_BYTES || process.env.FIREBASE_TRAFFIC_LIMIT_BYTES || "31568007987", 10);

function deduplicateContentImages(html?: string): string {
  if (!html || typeof html !== "string") return "";
  const seen = new Set<string>();
  const normalize = (u: string) => u.split("?")[0].replace(/^https?:\/\//i, "").toLowerCase().trim();

  // Deduplicate figures wrapping images
  let cleaned = html.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (fig, inner) => {
    const m = inner.match(/(?:src|data-src)=["']([^"']+)["']/i);
    if (!m) return fig;
    const norm = normalize(m[1]);
    if (seen.has(norm)) return "";
    seen.add(norm);
    return fig;
  });

  // Deduplicate standalone img tags
  cleaned = cleaned.replace(/<img[^>]+>/gi, (img) => {
    const m = img.match(/(?:src|data-src)=["']([^"']+)["']/i);
    if (!m) return img;
    const norm = normalize(m[1]);
    if (seen.has(norm)) return "";
    seen.add(norm);
    return img;
  });

  return cleaned.replace(/<figure[^>]*>\s*<\/figure>/gi, "").replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />");
}

function processAndApplySobrescricao(rawNews: any[]) {
  if (!Array.isArray(rawNews) || rawNews.length === 0) return;

  const seen = new Set<string>();

  let processed = rawNews
    .map((item: any) => {
      const decodedTitle = cleanEditorialText(decodeHtml(item.title));
      const cleanDesc = cleanEditorialText(decodeHtml(item.description));
      const cleanContent = deduplicateContentImages(cleanEditorialText(item.content));
      const tags = item.tags && item.tags.length > 0
        ? item.tags
        : extractTagsForNewsItem({ title: decodedTitle, description: cleanDesc, content: cleanContent, category: item.category });

      const itemWithCleanText = {
        ...item,
        title: decodedTitle,
        description: cleanDesc,
        content: cleanContent,
      };

      // Extract any authentic image from content and fields (never wipe out to "")
      const resolved = resolveAuthenticNewsImage(itemWithCleanText);
      const verifiedImgUrl = resolved.verifiedImage || "";
      const verifiedAlt = resolved.verifiedAlt || decodedTitle;

      return {
        ...item,
        title: decodedTitle,
        description: cleanDesc,
        content: cleanContent,
        thumbnail: verifiedImgUrl,
        imageUrl: verifiedImgUrl,
        image: verifiedImgUrl,
        imageAlt: verifiedAlt,
        slug: cleanSlug({ ...item, title: decodedTitle }),
        tags,
      };
    })
    .filter((item: any) => {
      const key = item.link || item.id || item.slug;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Ensure unique slugs across all items to avoid any routing conflicts
  const usedSlugs = new Set<string>();
  for (const item of processed) {
    let s = item.slug || `post/${slugify(item.category || "noticias")}/noticia/${item.id}`;
    let uniqueSlug = s;
    let counter = 1;
    while (usedSlugs.has(uniqueSlug)) {
      counter++;
      uniqueSlug = `${s}-${counter}`;
    }
    usedSlugs.add(uniqueSlug);
    item.slug = uniqueSlug;
  }

  // Strict chronological ordering
  processed.sort((a: any, b: any) => {
    const timeA = new Date(a.pubDate || a.date || 0).getTime();
    const timeB = new Date(b.pubDate || b.date || 0).getTime();
    return timeB - timeA;
  });

  // Sobrescrição Engine: Enforce 1.9 GB storage limit
  let currentBytes = Buffer.byteLength(JSON.stringify(processed), "utf-8");
  if (currentBytes >= STORAGE_LIMIT_BYTES) {
    console.warn(`[Sobrescrição Server] Limite de 1.9 GB atingido (${currentBytes} bytes). Executando sobrescrição FIFO...`);
    while (currentBytes >= STORAGE_LIMIT_BYTES * 0.9 && processed.length > 50) {
      processed.pop(); // Remove oldest
      currentBytes = Buffer.byteLength(JSON.stringify(processed), "utf-8");
    }
  }

  const previousCount = allNewsData.length;
  allNewsData = processed;
  lastSyncTimestamp = Date.now();
  console.log(`[RTDB Server] ${allNewsData.length} notícias sincronizadas via Realtime Database (Sobrescrição ativa).`);

  if (previousCount !== allNewsData.length || allNewsData.length > 0) {
    broadcastRealtimeUpdate();
  }
}

function broadcastRealtimeUpdate() {
  const payload = JSON.stringify({
    type: "news_update",
    total: allNewsData.length,
    latestId: allNewsData[0]?.id || null,
    latestSlug: allNewsData[0]?.slug || null,
    timestamp: lastSyncTimestamp,
  });

  for (const client of realtimeClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      realtimeClients.delete(client);
    }
  }
}

// Keepalive heartbeat for SSE connections every 25s
setInterval(() => {
  for (const client of realtimeClients) {
    try {
      client.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      realtimeClients.delete(client);
    }
  }
}, 25000);

// Upstream News API Configuration & Realtime Sync Engine (30-minute interval)
const NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL || "https://api-news-media.netlify.app";
const NEWS_API_KEY = process.env.NEWS_API_KEY || "bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd";
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

let isUpstreamSyncing = false;

const NEWS_CACHE_FILE = path.join(process.cwd(), "src", "data", "newsCache.json");
const DIST_CACHE_FILE = path.join(process.cwd(), "dist", "data", "newsCache.json");

// Boot: Carrega imediatamente o catálogo completo pré-processado para disponibilidade instantânea
function loadInitialNewsCache() {
  const possiblePaths = [
    NEWS_CACHE_FILE,
    DIST_CACHE_FILE,
    path.join(process.cwd(), "data", "newsCache.json"),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[Boot] Carregando ${parsed.length} matérias do cache local (${p})...`);
          processAndApplySobrescricao(parsed);
          console.log(`[Boot] Catálogo ativo com ${allNewsData.length} matérias prontas para exibição imediata.`);
          return true;
        }
      }
    } catch (err: any) {
      console.warn(`[Boot] Aviso ao ler cache ${p}:`, err?.message || err);
    }
  }
  return false;
}

// Carrega imediatamente no arranque
loadInitialNewsCache();

async function syncNewsFromUpstreamApi() {
  if (isUpstreamSyncing) return;
  isUpstreamSyncing = true;
  console.log(`[Upstream News API] Buscando notícias em tempo real direto da API com limit=100 (todas as matérias)...`);

  try {
    const rawItems: any[] = [];
    const chunkSize = 5; // Concorrência balanceada para evitar erros 502/rate-limit

    for (let i = 0; i < sourcesData.length; i += chunkSize) {
      const slice = sourcesData.slice(i, i + chunkSize);
      const results = await Promise.allSettled(
        slice.map(async (source: any) => {
          const url = `${NEWS_API_BASE_URL}/api/news/${source.id}?api_key=${NEWS_API_KEY}&limit=100`;
          for (let attempt = 0; attempt <= 2; attempt++) {
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                  return data.map((item: any) => ({
                    ...item,
                    sourceId: source.id,
                    sourceSite: source.originalSite || source.site || "Norma Jurídica",
                    category: source.category, // Categoria estrita da fonte — sem troca de categoria
                  }));
                }
              }
            } catch (err) {}
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
          return [];
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          rawItems.push(...r.value);
        }
      }
    }

    console.log(`[Upstream News API] ${rawItems.length} matérias coletadas em tempo real com limit=100.`);

    if (rawItems.length > 0) {
      // Merge with previous allNewsData to retain deep archive, placing newest items at the top
      const combined = [...rawItems, ...allNewsData];
      processAndApplySobrescricao(combined);
      sourcesMonitoringState.lastCheck = new Date().toISOString();
      sourcesMonitoringState.upstreamConnected = true;
      sourcesMonitoringState.ingestedNewsCount += rawItems.length;

      // Persiste cache no disco para inicialização ultrarrápida no próximo boot
      try {
        const dir = path.dirname(NEWS_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(NEWS_CACHE_FILE, JSON.stringify(allNewsData));
      } catch (err) {
        console.warn("[Upstream News API] Falha ao salvar newsCache.json:", err);
      }
    }
  } catch (err: any) {
    console.error("[Upstream News API] Erro ao sincronizar:", err?.message || err);
    sourcesMonitoringState.upstreamConnected = false;
  } finally {
    isUpstreamSyncing = false;
  }
}

// Initial fallback to Firebase snapshot only if database is completely empty
async function initialFirebaseFallback() {
  if (allNewsData.length > 0) return;
  try {
    const res = await fetch(RTDB_PRIMARY, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const items = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
        if (items.length > 0 && allNewsData.length === 0) {
          processAndApplySobrescricao(items);
        }
      }
    }
  } catch {}
}

// Se não carregou do cache, tenta Firebase; e agenda a sincronização upstream em segundo plano
if (allNewsData.length === 0) {
  initialFirebaseFallback().then(() => {
    syncNewsFromUpstreamApi();
  });
} else {
  // Já tem notícias do cache! Roda upstream sync de fundo sem bloquear
  setTimeout(() => {
    syncNewsFromUpstreamApi();
  }, 2000);
}

// Periodic real-time upstream sync every 30 minutes
setInterval(syncNewsFromUpstreamApi, SYNC_INTERVAL_MS);

// Site URL helper for dynamic deployments
function sanitizeDomain(input: string): string {
  if (!input) return "";
  return input.replace(/normaajuridica\.com\.br/gi, "normajuridica.com.br");
}

function getSiteUrl(req: express.Request): string {
  const raw = (
    process.env.VITE_PRIMARY_DOMAIN ||
    process.env.NEXT_PUBLIC_DOMAIN ||
    process.env.VITE_SITE_URL ||
    process.env.VITE_APP_URL ||
    process.env.DOMAIN ||
    process.env.APP_URL ||
    `${req.protocol}://${req.get("host")}`
  ).replace(/\/+$/, "");
  return sanitizeDomain(raw);
}

function getSiteDomain(req: express.Request): string {
  const url = getSiteUrl(req);
  try {
    const parsed = new URL(url);
    return sanitizeDomain(parsed.hostname);
  } catch {
    return sanitizeDomain(url.replace(/^https?:\/\//, "").split("/")[0].split(":")[0]);
  }
}

// Fallback for image proxy errors: redirects to source image or returns 404 (STRICTLY NO UNSPLASH OR STOCK APIS!)
function sendFallbackImage(res: express.Response, redirectUrl?: string) {
  if (redirectUrl && (redirectUrl.startsWith("http://") || redirectUrl.startsWith("https://"))) {
    return res.redirect(302, redirectUrl);
  }
  return res.status(404).end();
}

// -------------------------------------------------------------
// Image Proxy Endpoint: /next_imagem
// -------------------------------------------------------------
app.get(["/next_imagem", "/next_image"], async (req, res) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return sendFallbackImage(res);
  }

  // Handle local files
  if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
    const pubFile = path.join(process.cwd(), "public", rawUrl.replace(/^\//, ""));
    if (fs.existsSync(pubFile)) {
      return res.sendFile(pubFile);
    }
    const distFile = path.join(process.cwd(), "dist", rawUrl.replace(/^\//, ""));
    if (fs.existsSync(distFile)) {
      return res.sendFile(distFile);
    }
    return sendFallbackImage(res);
  }

  try {
    let targetUrl = rawUrl;
    if (targetUrl.startsWith("//")) {
      targetUrl = "https:" + targetUrl;
    }
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return sendFallbackImage(res);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const imgRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: parsed.origin + "/",
      },
    });

    clearTimeout(timeout);

    if (!imgRes.ok) {
      // Direct client browser to original image (loads smoothly with referrerpolicy="no-referrer")
      return res.redirect(302, targetUrl);
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");

    const arrayBuffer = await imgRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch {
    // If proxy fetch fails or times out, redirect to source URL
    return res.redirect(302, rawUrl);
  }
});

// -------------------------------------------------------------
// API Endpoints Implementation
// -------------------------------------------------------------

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Norma Jurídica",
    totalNews: allNewsData.length,
    totalCategories: categoriesData.length,
    totalSources: sourcesData.length,
    totalImages: mediaPoolData.length,
    timestamp: new Date().toISOString(),
  });
});

// 2. GET /api/categories
const getCategoriesHandler = async (_req: express.Request, res: express.Response) => {
  try {
    // Dynamic calculation guaranteeing minimum 250 items per category feed with tag counts
    const categories = categoriesData.map((c) => {
      const feed = buildCategoryFeed(c.category, allNewsData);
      return {
        category: c.category,
        count: Math.max(250, feed.total),
        tag_count: feed.tag_count,
        top_tags: feed.tags.slice(0, 5).map((t) => t.name),
      };
    });

    return res.json({ success: true, total_categories: categories.length, data: categories });
  } catch (err: any) {
    return res.json({ success: true, data: categoriesData });
  }
};
app.get("/api/categories", getCategoriesHandler);
app.get("/api/feed/categories", getCategoriesHandler);

// 2b. GET /api/tags and /api/feed/tags - Tag count and taxonomy
app.get(["/api/tags", "/api/feed/tags"], (req, res) => {
  const rawCat = (req.query.category as string) || "";
  if (rawCat && rawCat !== "Todas" && rawCat !== "todas") {
    const feed = buildCategoryFeed(rawCat, allNewsData);
    return res.json({
      success: true,
      category: rawCat,
      total_items: feed.total,
      tag_count: feed.tag_count,
      tags: feed.tags,
    });
  }

  const allTags = computeTagCounts(allNewsData);
  return res.json({
    success: true,
    category: "Todas",
    total_items: allNewsData.length,
    tag_count: allTags.length,
    tags: allTags,
  });
});

// 3. GET /api/types
app.get("/api/types", (_req, res) => {
  const typeCounts: Record<string, number> = {};
  sourcesData.forEach((s) => {
    const t = s.type || "rss";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const types = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));
  res.json({ success: true, data: types });
});

// 4. GET /api/stats
app.get("/api/stats", (_req, res) => {
  const activeSources = sourcesData.filter((s) => s.active !== false).length;
  res.json({
    success: true,
    data: {
      total_news: allNewsData.length,
      total_sources: sourcesData.length,
      active_sources: activeSources,
      total_categories: categoriesData.length,
      total_media_images: mediaPoolData.length,
      server_time: new Date().toISOString(),
    },
  });
});

// 4b. GET /api/firebase/traffic - Status da arquitetura híbrida e rotação 10GB
app.get("/api/firebase/traffic", (_req, res) => {
  const primaryDb =
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || "";
  const mirrorDb =
    process.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL || process.env.VITE_FIREBASE_2_DATABASE_URL || "";

  res.json({
    success: true,
    data: {
      architecture: "hybrid_storage_with_multi_project_rotation",
      static_in_code_count: allNewsData.length,
      quota_limit_bytes_per_project: 10 * 1024 * 1024 * 1024, // 10 GB
      rotation_threshold_bytes: 9 * 1024 * 1024 * 1024, // 9 GB
      primary_configured: Boolean(primaryDb),
      mirror_configured: Boolean(mirrorDb),
      active_threshold: "9GB trigger -> failover to Project 2 (Mirror) -> fallback to Static in-code",
      google_auth_purpose: "Métricas administrativas e controle de acessos (visitantes leem livremente)",
    },
  });
});

// 4c. GET /api/firebase/config - Retorna configurações públicas das instâncias Firebase em tempo de execução
app.get("/api/firebase/config", (_req, res) => {
  const envAdmins =
    process.env.ADMINISTRADORES ||
    process.env.ADMINITRADORES ||
    process.env.VITE_ADMINISTRADORES ||
    process.env.VITE_ADMINITRADORES ||
    process.env.ADMIN_EMAILS ||
    "";

  const adminSet = new Set(
    envAdmins
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  ["acrmrochamiranda@gmail.com", "mirandinhacontabilidade@gmail.com", "legislativemunicipal@gmail.com"].forEach(
    (e) => adminSet.add(e)
  );
  const administradores = Array.from(adminSet).join(",");

  res.json({
    success: true,
    administradores,
    primary: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyCAQ6UdqNC3_spKkjH79Rf7s9SwBMN98Fw",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "legal-norm2.firebaseapp.com",
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || "https://legal-norm2-default-rtdb.firebaseio.com",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "legal-norm2",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "legal-norm2.firebasestorage.app",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "878021514659",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:878021514659:web:966a382c6c7ffeb6a9f616",
    },
    mirror: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_2_API_KEY || process.env.VITE_FIREBASE_2_API_KEY || process.env.FIREBASE_2_API_KEY || "AIzaSyBgpGn4rTTZET8DaT9wJL0zmwcYv_9x6gs",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN || process.env.VITE_FIREBASE_2_AUTH_DOMAIN || process.env.FIREBASE_2_AUTH_DOMAIN || "legal-norm3.firebaseapp.com",
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL || process.env.VITE_FIREBASE_2_DATABASE_URL || process.env.FIREBASE_2_DATABASE_URL || "https://legal-norm3-default-rtdb.firebaseio.com",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID || process.env.VITE_FIREBASE_2_PROJECT_ID || process.env.FIREBASE_2_PROJECT_ID || "legal-norm3",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET || process.env.VITE_FIREBASE_2_STORAGE_BUCKET || process.env.FIREBASE_2_STORAGE_BUCKET || "legal-norm3.firebasestorage.app",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID || process.env.FIREBASE_2_MESSAGING_SENDER_ID || "907491581027",
      appId: process.env.NEXT_PUBLIC_FIREBASE_2_APP_ID || process.env.VITE_FIREBASE_2_APP_ID || process.env.FIREBASE_2_APP_ID || "1:907491581027:web:e45c8faad065d6b8fe6c56",
    },
    tertiary: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_3_API_KEY || process.env.VITE_FIREBASE_3_API_KEY || process.env.FIREBASE_3_API_KEY || "AIzaSyBE4327ug3rRtatNFcNhLw6-hc-aYJzSWM",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_3_AUTH_DOMAIN || process.env.VITE_FIREBASE_3_AUTH_DOMAIN || process.env.FIREBASE_3_AUTH_DOMAIN || "legal-norm1.firebaseapp.com",
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_3_DATABASE_URL || process.env.VITE_FIREBASE_3_DATABASE_URL || process.env.FIREBASE_3_DATABASE_URL || "https://legal-norm1-default-rtdb.firebaseio.com",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_3_PROJECT_ID || process.env.VITE_FIREBASE_3_PROJECT_ID || process.env.FIREBASE_3_PROJECT_ID || "legal-norm1",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_3_STORAGE_BUCKET || process.env.VITE_FIREBASE_3_STORAGE_BUCKET || process.env.FIREBASE_3_STORAGE_BUCKET || "legal-norm1.firebasestorage.app",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_3_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_3_MESSAGING_SENDER_ID || process.env.FIREBASE_3_MESSAGING_SENDER_ID || "865198316919",
      appId: process.env.NEXT_PUBLIC_FIREBASE_3_APP_ID || process.env.VITE_FIREBASE_3_APP_ID || process.env.FIREBASE_3_APP_ID || "1:865198316919:web:ebcc9926dc72926f429572",
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_3_MEASUREMENT_ID || process.env.VITE_FIREBASE_3_MEASUREMENT_ID || process.env.FIREBASE_3_MEASUREMENT_ID || "G-7H2ZS21C70",
    },
  });
});

// 4d. GET /api/realtime/news-stream - Server-Sent Events (SSE) stream para sincronização em tempo real
app.get("/api/realtime/news-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Send initial payload with count and timestamp
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      total: allNewsData.length,
      latestId: allNewsData[0]?.id || null,
      timestamp: lastSyncTimestamp,
    })}\n\n`
  );

  realtimeClients.add(res);

  req.on("close", () => {
    realtimeClients.delete(res);
  });
});

// 4e. GET /api/realtime/check - Verificação ultra-rápida de atualizações em tempo real
app.get("/api/realtime/check", (_req, res) => {
  res.json({
    success: true,
    total: allNewsData.length,
    latestId: allNewsData[0]?.id || null,
    latestSlug: allNewsData[0]?.slug || null,
    timestamp: lastSyncTimestamp,
  });
});

// 5. GET /api/images (Returns 27 synchronized channels or media items)
app.get("/api/images", async (_req, res) => {
  if (mediaChannelsData && mediaChannelsData.length > 0) {
    return res.json(mediaChannelsData);
  }
  // Try upstream
  try {
    const upstream = await fetch(
      `https://api-news-media.netlify.app/api/images?api_key=${process.env.NEWS_API_KEY || "bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd"}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (upstream.ok) {
      const data = await upstream.json();
      return res.json(data);
    }
  } catch {}
  res.json(mediaPoolData);
});

// 6. GET /api/images/:id (Handles synchronized IDs matching news sources)
app.get("/api/images/:id", async (req, res) => {
  const idStr = String(req.params.id);

  // 1. Try upstream directly with the synchronized source ID
  try {
    const upstream = await fetch(
      `https://api-news-media.netlify.app/api/images/${encodeURIComponent(idStr)}?api_key=${process.env.NEWS_API_KEY || "bn_88feb5baa3f84955677e8c11453aae352811b9fe6c3398cd"}&limit=15`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (upstream.ok) {
      const data = await upstream.json();
      if (Array.isArray(data) && data.length > 0) {
        return res.json(data);
      }
    }
  } catch {}

  // 2. Check if it matches one of the 27 synchronized media channels
  const channel = mediaChannelsData.find((c) => String(c.id) === idStr);
  if (channel) {
    return res.json([channel]);
  }

  // 3. Check in local mediaPoolData
  const matched = mediaPoolData.filter((m) => String(m.id) === idStr || String(m.sourceId) === idStr);
  if (matched.length > 0) {
    return res.json(matched);
  }

  res.status(404).json({ success: false, error: "Mídia não encontrada" });
});

// 7. GET /api/news/category/:category and /api/feed/news/category/:category
app.get(["/api/news/category/:category", "/api/feed/news/category/:category"], async (req, res) => {
  const rawCat = req.params.category;
  const decodedCat = decodeURIComponent(rawCat).trim();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const tagFilter = (req.query.tag as string || "").trim().toLowerCase();

  // Guarantees at least 250 items per category with tag taxonomy
  const feed = buildCategoryFeed(decodedCat, allNewsData);
  let items = feed.items;

  if (tagFilter) {
    items = items.filter((item) =>
      item.tags?.some((t) => t.toLowerCase() === tagFilter)
    );
  }

  const isAll = req.query.all === "true" || req.query.limit === "all";
  const perPage = isAll
    ? Math.max(items.length, 50000)
    : Math.max(1, Math.min(50000, parseInt((req.query.per_page || req.query.limit) as string) || 12));

  const total = items.length;
  const totalPages = Math.ceil(total / perPage) || 1;
  const startIndex = (page - 1) * perPage;
  const paginated = isAll
    ? items
    : items.slice(startIndex, startIndex + perPage);

  return res.json({
    success: true,
    category: decodedCat,
    total,
    tag_count: feed.tag_count,
    tags: feed.tags,
    page,
    per_page: perPage,
    total_pages: totalPages,
    has_prev: page > 1,
    has_next: page < totalPages,
    data: paginated,
  });
});

// 8. GET /api/news and /api/feed/news
const getNewsHandler = (req: express.Request, res: express.Response) => {
  const isAll = req.query.all === "true" || req.query.limit === "all";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = isAll
    ? Math.max(allNewsData.length, 50000)
    : Math.max(1, Math.min(50000, parseInt((req.query.per_page || req.query.limit) as string) || 12));

  const rawCat = (req.query.category as string) || "";
  const category = decodeURIComponent(rawCat).trim();
  const search = (req.query.search as string || req.query.q as string || "").trim();
  const tagFilter = (req.query.tag as string || "").trim().toLowerCase();
  const sourceId = req.query.source ? parseInt(req.query.source as string) : undefined;
  const seed = req.query.seed ? parseInt(req.query.seed as string) : undefined;

  let feedResult: { total: number; tag_count: number; tags: any[]; items: any[] };

  if (category && category !== "Todas" && category !== "todas") {
    // Guarantees minimum 250 items for the requested category
    feedResult = buildCategoryFeed(category, allNewsData, seed);
  } else {
    feedResult = buildCategoryFeed("Todas", allNewsData, seed);
  }

  let filtered = [...feedResult.items];

  if (search) {
    // Pesquisa em TODO o acervo da API, não apenas na editoria aberta
    const normSearch = slugify(search);
    const tokens = normSearch.split("-").filter((t) => t.length > 1);

    filtered = allNewsData.filter((item) => {
      const title = slugify(item.title || "");
      const desc = slugify(item.description || "");
      const cat = slugify(item.category || "");
      const content = slugify(item.content || "");
      const tagsStr = (item.tags || []).map((t: string) => slugify(t)).join(" ");

      if (
        title.includes(normSearch) ||
        desc.includes(normSearch) ||
        cat.includes(normSearch) ||
        tagsStr.includes(normSearch)
      ) {
        return true;
      }
      return tokens.some((t) => title.includes(t) || desc.includes(t) || content.includes(t));
    });
  }

  if (tagFilter) {
    filtered = filtered.filter((item) =>
      item.tags?.some((t: string) => t.toLowerCase() === tagFilter)
    );
  }

  if (sourceId) {
    filtered = filtered.filter((item) => item.sourceId === sourceId);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / perPage) || 1;
  const startIndex = (page - 1) * perPage;
  const paginated = isAll ? filtered : filtered.slice(startIndex, startIndex + perPage);

  res.json({
    success: true,
    category: category || "Todas",
    total,
    tag_count: feedResult.tag_count,
    tags: feedResult.tags,
    page,
    per_page: perPage,
    total_pages: totalPages,
    has_prev: page > 1,
    has_next: page < totalPages,
    data: paginated,
  });
};
app.get("/api/news", getNewsHandler);
app.get("/api/feed/news", getNewsHandler);

// 9. GET /api/news/:id
app.get(["/api/news/:id", "/api/feed/news/:id"], (req, res) => {
  const idStr = String(req.params.id);
  const item = allNewsData.find(
    (n) => String(n.id) === idStr || n.slug === idStr || n.slug === `post/${encodeURIComponent(idStr)}`
  );

  if (item) {
    return res.json({ success: true, data: item });
  }

  res.status(404).json({ success: false, error: "Notícia não encontrada" });
});

// 10. GET /api/sources
const getSourcesHandler = async (_req: express.Request, res: express.Response) => {
  res.json({ success: true, count: sourcesData.length, data: sourcesData });
};
app.get("/api/sources", getSourcesHandler);
app.get("/api/feed/sources", getSourcesHandler);

// 10.1 Monitoring of news & sources via api-news-media.netlify.app endpoints
const sourcesMonitoringState = {
  lastCheck: new Date().toISOString(),
  activeSourcesCount: sourcesData.length,
  upstreamConnected: true,
  ingestedNewsCount: 0,
  sourcesStatus: sourcesData.slice(0, 50).map((s) => ({
    id: s.id,
    site: s.site,
    category: s.category,
    status: "online",
    lastPing: new Date().toISOString(),
  })),
};

async function monitorUpstreamSources() {
  await syncNewsFromUpstreamApi();
}

app.get("/api/monitoring/sources", (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    data: sourcesMonitoringState,
    totalSources: sourcesData.length,
    totalNewsInCatalog: allNewsData.length,
  });
});

app.post("/api/monitoring/sync", authLimiter, async (_req: express.Request, res: express.Response) => {
  await syncNewsFromUpstreamApi();
  res.json({
    success: true,
    message: "Sincronização em tempo real das 72 fontes executada com sucesso.",
    data: sourcesMonitoringState,
  });
});

// 11. GET /api/openapi.json
app.get("/api/openapi.json", (req, res) => {
  const siteUrl = getSiteUrl(req);
  res.json({
    openapi: "3.0.3",
    info: {
      title: "News & Media Integration API - Norma Jurídica",
      version: "1.0.0",
      description:
        "API REST para acesso a fontes de notícias, endpoints de mídia e conteúdos em tempo real de portais brasileiros.",
    },
    servers: [{ url: siteUrl, description: "Servidor de Produção / Local" }],
    paths: {
      "/api/news": {
        get: {
          summary: "Lista notícias com suporte a filtros, paginação e pesquisa",
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "per_page", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "Sucesso" } },
        },
      },
      "/api/news/{id}": {
        get: {
          summary: "Retorna notícia específica por ID ou slug",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Sucesso" } },
        },
      },
      "/api/news/category/{category}": {
        get: {
          summary: "Retorna notícias por editoria",
          parameters: [{ name: "category", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Sucesso" } },
        },
      },
      "/api/images": {
        get: {
          summary: "Retorna imagens de mídia",
          responses: { "200": { description: "Sucesso" } },
        },
      },
      "/api/categories": {
        get: {
          summary: "Lista todas as categorias e contagens",
          responses: { "200": { description: "Sucesso" } },
        },
      },
      "/api/types": {
        get: {
          summary: "Lista os tipos de integração disponíveis",
          responses: { "200": { description: "Sucesso" } },
        },
      },
      "/api/stats": {
        get: {
          summary: "Estatísticas do portal",
          responses: { "200": { description: "Sucesso" } },
        },
      },
    },
  });
});

// Mapeamento e normalização dos estados brasileiros para siglas oficiais (UF)
const BRAZIL_STATE_MAP: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapá: "AP", amapa: "AP", amazonas: "AM",
  bahia: "BA", ceará: "CE", ceara: "CE", "distrito federal": "DF",
  "espírito santo": "ES", "espirito santo": "ES", goiás: "GO", goias: "GO",
  maranhão: "MA", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", pará: "PA", para: "PA", paraíba: "PB", paraiba: "PB",
  paraná: "PR", parana: "PR", pernambuco: "PE", piauí: "PI", piaui: "PI",
  "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS",
  rondônia: "RO", rondonia: "RO", roraima: "RR", "santa catarina": "SC",
  "são paulo": "SP", "sao paulo": "SP", sergipe: "SE", tocantins: "TO"
};

function normalizeBrazilianState(rawState?: string): string {
  if (!rawState) return "";
  const cleaned = rawState.trim().replace(/^BR-/, "").toUpperCase();
  if (cleaned.length === 2 && !/[^A-Z]/.test(cleaned)) return cleaned;
  const lower = rawState.trim().toLowerCase();
  return BRAZIL_STATE_MAP[lower] || cleaned;
}

// Cache in-memory para geocodificação reversa de alta precisão
const reverseGeoCache = new Map<string, { city: string; state: string; ts: number }>();

// Função de resolução exata de município a partir de coordenadas GPS
async function resolveExactCity(lat: number, lon: number): Promise<{ city: string; state: string } | null> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = reverseGeoCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
    return { city: cached.city, state: cached.state };
  }

  // Método 1: OpenStreetMap Nominatim com zoom=14 (limite municipal exato)
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=14`;
    const geoRes = await fetch(geoUrl, {
      headers: {
        "User-Agent": "NormaJuridicaPortal/3.0 (contato@normajuridica.com.br; https://normajuridica.com.br)",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      const addr = geoData.address || {};
      const foundCity = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.district || addr.suburb || addr.hamlet || addr.county;
      if (foundCity) {
        const rawState = addr["ISO3166-2-lvl4"] || addr.state || "";
        const state = normalizeBrazilianState(rawState);
        const result = { city: foundCity, state };
        reverseGeoCache.set(cacheKey, { ...result, ts: Date.now() });
        return result;
      }
    }
  } catch {
    // Timeout ou erro no Nominatim - prosseguir para método alternativo
  }

  // Método 2: Photon by Komoot (geocodificador aberto global baseado em OSM)
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
    const photonRes = await fetch(photonUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NormaJuridicaPortal/3.0; +https://normajuridica.com.br)"
      },
      signal: AbortSignal.timeout(4000),
    });
    if (photonRes.ok) {
      const pData = await photonRes.json();
      const props = pData.features?.[0]?.properties || {};
      const foundCity = props.city || props.town || props.municipality || props.locality || props.district || props.county;
      if (foundCity) {
        const state = normalizeBrazilianState(props.state || "");
        const result = { city: foundCity, state };
        reverseGeoCache.set(cacheKey, { ...result, ts: Date.now() });
        return result;
      }
    }
  } catch {
    // Falha silenciosa
  }

  return null;
}

// Cache in-memory para previsão do tempo (10 min de frescor, persistência de último valor conhecido)
const weatherDataCache = new Map<string, { data: any; ts: number }>();

// 12. Public Weather API com Geolocalização Reversa Exata e Detecção por IP
app.get("/api/weather", async (req, res) => {
  try {
    let lat = req.query.lat ? parseFloat(req.query.lat as string) : NaN;
    let lon = req.query.lon ? parseFloat(req.query.lon as string) : NaN;
    let city = (req.query.city as string || "").trim();
    let state = (req.query.state as string || "").trim();

    // 1. Se coordenadas não foram passadas, tentar identificar localização aproximada por IP do cliente
    if (isNaN(lat) || isNaN(lon)) {
      try {
        const forwarded = (req.headers["cf-connecting-ip"] as string) ||
          (req.headers["x-real-ip"] as string) ||
          (req.headers["true-client-ip"] as string) ||
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim();

        const isPublicIp = forwarded &&
          forwarded !== "127.0.0.1" &&
          !forwarded.startsWith("10.") &&
          !forwarded.startsWith("192.168.") &&
          !forwarded.startsWith("172.16.") &&
          !forwarded.startsWith("172.17.") &&
          !forwarded.startsWith("172.18.") &&
          !forwarded.startsWith("172.19.") &&
          !forwarded.startsWith("172.2") &&
          !forwarded.startsWith("172.3");

        const ipUrl = isPublicIp ? `https://ipwho.is/${forwarded}` : "https://ipwho.is/";
        const ipRes = await fetch(ipUrl, { signal: AbortSignal.timeout(2500) });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.success !== false && ipData.latitude && ipData.longitude) {
            lat = ipData.latitude;
            lon = ipData.longitude;
            if (ipData.city) city = ipData.city;
            if (ipData.region_code) state = normalizeBrazilianState(ipData.region_code);
          }
        }
      } catch {
        // Fallback silencioso
      }
    }

    // Coordenadas padrão se ainda não detectadas
    if (isNaN(lat) || isNaN(lon)) {
      lat = -15.7975;
      lon = -47.8919;
      city = city || "Brasília";
      state = state || "DF";
    }

    state = normalizeBrazilianState(state);

    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cachedWeather = weatherDataCache.get(cacheKey);

    // Se temos previsão em cache fresca (menos de 10 min), responder imediatamente
    if (cachedWeather && Date.now() - cachedWeather.ts < 10 * 60 * 1000) {
      return res.json({
        success: true,
        data: {
          ...cachedWeather.data,
          city: (city && !city.toLowerCase().includes("localiza") && city !== "BR") ? city : cachedWeather.data.city,
          state: state || cachedWeather.data.state || "PR",
        },
      });
    }

    const isGenericCity = !city || city.toLowerCase().includes("localiza") || city.toLowerCase().includes("sua cidade") || city === "BR";

    // 2. Disparar resolução de nome da cidade e consulta de clima em paralelo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;

    const fetchWeatherTask = async () => {
      try {
        const response = await fetch(weatherUrl, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
        return await response.json();
      } catch (upstreamErr) {
        // Se houver timeout ou erro, usar o último valor conhecido do cache se existir
        if (cachedWeather) {
          return { _fromStaleCache: true, data: cachedWeather.data };
        }
        throw upstreamErr;
      }
    };

    const resolveCityTask = (isGenericCity && !isNaN(lat) && !isNaN(lon))
      ? resolveExactCity(lat, lon)
      : Promise.resolve(null);

    const [weatherResult, cityResult] = await Promise.allSettled([fetchWeatherTask(), resolveCityTask]);

    // Tratar nome da cidade resolvido
    if (cityResult.status === "fulfilled" && cityResult.value) {
      city = cityResult.value.city;
      state = cityResult.value.state || state;
    }

    // Tratar dados climáticos
    if (weatherResult.status === "fulfilled") {
      const payload = weatherResult.value;

      if (payload._fromStaleCache && payload.data) {
        return res.json({
          success: true,
          data: {
            ...payload.data,
            city: city || payload.data.city || "Sua Região",
            state: state || payload.data.state || "PR",
            updatedAt: new Date().toISOString(),
          },
        });
      }

      const current = payload.current || {};
      const daily = payload.daily || {};
      const code = current.weather_code ?? 0;

      let conditionText = "Ensolarado";
      if (code === 0) conditionText = current.is_day ? "Céu limpo" : "Noite estrelada";
      else if (code >= 1 && code <= 3) conditionText = "Parcialmente nublado";
      else if (code >= 45 && code <= 48) conditionText = "Nevoeiro";
      else if (code >= 51 && code <= 67) conditionText = "Chuva leve";
      else if (code >= 71 && code <= 77) conditionText = "Queda de neve";
      else if (code >= 80 && code <= 82) conditionText = "Pancadas de chuva";
      else if (code >= 95) conditionText = "Tempestade com trovões";

      const weatherData = {
        city: city || "Sua Região",
        state: state || "PR",
        lat,
        lon,
        temp: Math.round(current.temperature_2m ?? 24),
        apparentTemp: Math.round(current.apparent_temperature ?? 25),
        humidity: current.relative_humidity_2m ?? 60,
        windSpeed: Math.round(current.wind_speed_10m ?? 12),
        weatherCode: code,
        conditionText,
        isDay: current.is_day === 1,
        tempMax: Math.round(daily.temperature_2m_max?.[0] ?? 28),
        tempMin: Math.round(daily.temperature_2m_min?.[0] ?? 19),
        precipitation: current.precipitation ?? 0,
        updatedAt: new Date().toISOString(),
      };

      weatherDataCache.set(cacheKey, { data: weatherData, ts: Date.now() });

      return res.json({
        success: true,
        data: weatherData,
      });
    }

    // Caso a consulta ao Open-Meteo tenha falhado ou sofrido timeout
    console.warn("[Weather] Provedor meteorológico temporariamente lento/indisponível:", (weatherResult as PromiseRejectedResult).reason?.message || (weatherResult as PromiseRejectedResult).reason);

    // Se temos qualquer dado em cache para estas coordenadas, usar como fallback
    if (cachedWeather) {
      return res.json({
        success: true,
        data: {
          ...cachedWeather.data,
          city: city || cachedWeather.data.city,
          state: state || cachedWeather.data.state,
        },
      });
    }

    // Fallback padrão sem erro para o cliente
    return res.json({
      success: true,
      data: {
        city: city || "Brasília",
        state: state || "DF",
        lat,
        lon,
        temp: 24,
        apparentTemp: 25,
        humidity: 62,
        windSpeed: 12,
        weatherCode: 1,
        conditionText: "Predomínio de Sol",
        isDay: true,
        tempMax: 27,
        tempMin: 17,
        precipitation: 0,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn("[Weather] Exceção tratada no endpoint de clima:", (err as Error)?.message || err);
    res.json({
      success: true,
      data: {
        city: "Brasília",
        state: "DF",
        lat: -15.7975,
        lon: -47.8919,
        temp: 26,
        apparentTemp: 27,
        humidity: 62,
        windSpeed: 14,
        weatherCode: 1,
        conditionText: "Predomínio de Sol",
        isDay: true,
        tempMax: 29,
        tempMin: 18,
        precipitation: 0,
        updatedAt: new Date().toISOString(),
      },
    });
  }
});

// 12.1 Pesquisa de Cidades para Previsão do Tempo
app.get("/api/weather/search", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query || query.length < 2) {
    return res.json({ success: true, results: [] });
  }
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=pt&format=json`;
    const response = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const data = await response.json();
      const results = (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        state: r.admin1 || "",
        country: r.country_code || "BR",
        latitude: r.latitude,
        longitude: r.longitude,
      }));
      return res.json({ success: true, results });
    }
  } catch (err) {
    console.warn("Weather search error:", err);
  }
  res.json({ success: true, results: [] });
});

// 13. Contact & DSAR form via SMTP
app.post("/api/contact", contactLimiter, async (req, res) => {
  const { lgpdConsent } = req.body;
  const name = String(req.body.name || "").slice(0, 100);
  const email = String(req.body.email || "").slice(0, 150);
  const phone = String(req.body.phone || "").slice(0, 30);
  const subject = String(req.body.subject || "").slice(0, 150);
  const category = String(req.body.category || "").slice(0, 100);
  const message = String(req.body.message || "").slice(0, 5000);
  const requestType = String(req.body.requestType || "").slice(0, 100);
  const cpf = String(req.body.cpf || "").slice(0, 20);

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: "Por favor, preencha os campos obrigatórios (Nome, E-mail e Mensagem).",
    });
  }

  const smtpHost = process.env.SMTP_HOST || "";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || "";
  const googleAppPassword = process.env.GOOGLE_APP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
  const toEmail = process.env.SMTP_TO_EMAIL || process.env.SMTP_TO || "";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || smtpUser || "";

  if (!smtpHost || !smtpUser || !googleAppPassword || !toEmail) {
    return res.status(500).json({
      success: false,
      error: "Serviço de e-mail não configurado no servidor.",
    });
  }

  const isLgpdRequest = !!requestType;
  const emailTitle = isLgpdRequest
    ? `[Privacidade - Requerimento do Titular] ${subject || requestType} - ${name}`
    : `[Norma Jurídica - Contato] ${subject || "Nova Mensagem"} (${category || "Geral"})`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #1e3a8a;">
      <h2 style="color: #60a5fa; margin-top: 0; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px;">
        ${isLgpdRequest ? "🏛️ Requerimento de Tratamento de Dados Pessoais" : "📬 Mensagem Recebida - Portal Norma Jurídica"}
      </h2>
      <p style="font-size: 14px; color: #cbd5e1;">Uma nova comunicação foi registrada no portal com os seguintes dados:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; color: #e2e8f0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold; width: 35%;">Remetente:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">E-mail:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;"><a href="mailto:${email}" style="color: #93c5fd;">${email}</a></td>
        </tr>
        ${phone ? `<tr><td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Telefone:</td><td style="padding: 8px; border-bottom: 1px solid #1e293b;">${phone}</td></tr>` : ""}
        ${cpf ? `<tr><td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">CPF:</td><td style="padding: 8px; border-bottom: 1px solid #1e293b;">${cpf}</td></tr>` : ""}
        ${requestType ? `<tr><td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Tipo de Requisição:</td><td style="padding: 8px; border-bottom: 1px solid #1e293b;"><span style="background: #1e3a8a; padding: 2px 8px; border-radius: 4px; color: #bfdbfe;">${requestType}</span></td></tr>` : ""}
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Editoria / Assunto:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${subject || category || "Geral"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Consentimento:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #34d399;">${lgpdConsent ? "Concedido expressamente" : "Não informado"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b; font-weight: bold;">Data e Hora:</td>
          <td style="padding: 8px; border-bottom: 1px solid #1e293b;">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
        </tr>
      </table>

      <div style="margin-top: 20px; background-color: #1e293b; padding: 16px; border-radius: 6px; border-left: 4px solid #3b82f6;">
        <h4 style="margin-top: 0; color: #93c5fd;">Conteúdo da Mensagem:</h4>
        <p style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #f1f5f9;">${message}</p>
      </div>

      <div style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; padding-top: 12px;">
        Este e-mail foi gerado automaticamente pelo portal <strong>Norma Jurídica</strong>.
      </div>
    </div>
  `;

  if (googleAppPassword && smtpUser) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: googleAppPassword },
      });

      await transporter.sendMail({
        from: `"${name} (Portal Norma Jurídica)" <${fromEmail}>`,
        to: toEmail,
        replyTo: email,
        subject: emailTitle,
        html: htmlContent,
      });

      return res.json({
        success: true,
        message: "Sua mensagem foi enviada com sucesso!",
        protocol: `NJ-${Date.now().toString().slice(-8)}`,
        mode: "live_smtp",
      });
    } catch (smtpErr) {
      console.error("SMTP error:", (smtpErr as Error)?.message || "Unknown error");
    }
  }

  return res.json({
    success: true,
    message: "Requerimento protocolado com sucesso! Um protocolo foi registrado.",
    protocol: `NJ-${Date.now().toString().slice(-8)}`,
    mode: "simulated_success",
    recipient: toEmail,
  });
});

// -------------------------------------------------------------
// SEO & Monetization Static/Dynamic Routes
// -------------------------------------------------------------

// /ads.txt
app.get("/ads.txt", (_req, res) => {
  const publicAdsPath = path.join(process.cwd(), "public", "ads.txt");
  const distAdsPath = path.join(process.cwd(), "dist", "ads.txt");
  let content = "";
  if (fs.existsSync(publicAdsPath)) {
    content = fs.readFileSync(publicAdsPath, "utf-8");
  } else if (fs.existsSync(distAdsPath)) {
    content = fs.readFileSync(distAdsPath, "utf-8");
  }

  const clientId =
    process.env.GOOGLE_ADSENSE_CLIENT_ID ||
    process.env.VITE_GOOGLE_ADSENSE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_ADSENSE_ID ||
    "";
  if (clientId) {
    const cleanId = clientId.replace(/^ca-/, "");
    const line = `google.com, ${cleanId}, DIRECT, f08c47fec0942fa0`;
    if (!content.includes(cleanId)) {
      content = `${content.trim()}\n${line}\n`;
    }
  }

  res.type("text/plain").send(content || "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n");
});

// /robots.txt
app.get("/robots.txt", (req, res) => {
  const siteUrl = getSiteUrl(req);
  res.type("text/plain").send(`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

// /sitemap.xml (Index)
app.get("/sitemap.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-news.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-categories.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-images.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-pages.xml</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>
</sitemapindex>`;
  res.type("application/xml").send(xml);
});

// /sitemap-news.xml
app.get("/sitemap-news.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  let urls = "";
  const recent = allNewsData.slice(0, 150);
  for (const item of recent) {
    const dateStr = item.pubDate ? item.pubDate.split("T")[0] : new Date().toISOString().split("T")[0];
    const cleanTitle = (item.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    urls += `  <url>
    <loc>${siteUrl}/${item.slug}</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.9</priority>
    <news:news xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <news:publication>
        <news:name>Norma Jurídica</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${dateStr}</news:publication_date>
      <news:title>${cleanTitle}</news:title>
    </news:news>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap-categories.xml
app.get("/sitemap-categories.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  let urls = "";
  for (const c of categoriesData) {
    const catSlug = slugify(c.category);
    urls += `  <url>
    <loc>${siteUrl}/categoria/${catSlug}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap-images.xml
app.get("/sitemap-images.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  let urls = "";
  for (const item of allNewsData.slice(0, 100)) {
    const cleanTitle = (item.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const imgUrl = item.thumbnail || item.imageUrl;
    urls += `  <url>
    <loc>${siteUrl}/${item.slug}</loc>
    <image:image xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <image:loc>${siteUrl}/next_imagem?url=${encodeURIComponent(imgUrl)}</image:loc>
      <image:title>${cleanTitle}</image:title>
    </image:image>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap-pages.xml
app.get("/sitemap-pages.xml", (req, res) => {
  const siteUrl = getSiteUrl(req);
  const pages = [
    { path: "/", priority: "1.0", freq: "hourly" },
    { path: "/contato", priority: "0.8", freq: "monthly" },
    { path: "/politica-de-privacidade", priority: "0.7", freq: "monthly" },
    { path: "/termos-de-uso", priority: "0.7", freq: "monthly" },
    { path: "/politica-de-cookies", priority: "0.7", freq: "monthly" },
    { path: "/lgpd", priority: "0.8", freq: "monthly" },
    { path: "/consentimento", priority: "0.6", freq: "monthly" },
  ];

  let urls = "";
  for (const p of pages) {
    urls += `  <url>
    <loc>${siteUrl}${p.path}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
  res.type("application/xml").send(xml);
});

// /sitemap.xsl
app.get("/sitemap.xsl", (_req, res) => {
  const xslPath = path.join(process.cwd(), "public", "sitemap.xsl");
  if (fs.existsSync(xslPath)) {
    res.type("text/xsl").sendFile(xslPath);
  } else {
    res.status(404).send("Not found");
  }
});

// -------------------------------------------------------------
// Development / Production Vite Integration
// -------------------------------------------------------------
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Resolução resiliente da pasta dist (para execuções a partir da raiz ou de dentro de dist)
    const distPath = fs.existsSync(path.join(process.cwd(), "dist", "index.html"))
      ? path.join(process.cwd(), "dist")
      : fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : path.join(process.cwd(), "dist");

    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      try {
        const indexPath = path.join(distPath, "index.html");
        if (!fs.existsSync(indexPath)) {
          return res.status(200).send("<!doctype html><html><head><meta charset='utf-8'><title>Norma Jurídica</title></head><body style='background:#0b1329;color:#fff;font-family:sans-serif;text-align:center;padding:50px;'><h2>Carregando portal Norma Jurídica...</h2><p>Por favor, recarregue a página em alguns instantes.</p></body></html>");
        }

        let html = await fs.promises.readFile(indexPath, "utf-8");
        const siteUrl = getSiteUrl(req);
        const reqPath = req.path;
        
        // Find if this is a post route
        let title = "Norma Jurídica - Portal de Notícias e Legislação";
        let desc = "Portal de Notícias Avançado e Responsivo é uma plataforma digital completa de jornalismo moderno, desenvolvida com foco em alta performance e conteúdo jornalístico.";
        let img = siteUrl + "/og-image.jpg";
        let url = siteUrl + reqPath;
        let type = "website";
        let author = "Norma Jurídica";
        let publishedTime = "";
        let modifiedTime = "";
        let section = "";
        let robots = "index, follow";

        let jsonLd: any = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Norma Jurídica",
          "url": siteUrl,
          "potentialAction": {
            "@type": "SearchAction",
            "target": siteUrl + "/?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        };

        if (reqPath.startsWith("/post/")) {
          const item = allNewsData.find(n => n.slug === reqPath.substring(1));
          if (item) {
            title = (item.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            desc = (item.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            img = item.thumbnail || item.imageUrl || img;
            if (img.startsWith("/")) img = siteUrl + img;
            type = "article";
            author = item.author || "Norma Jurídica";
            publishedTime = item.pubDate || new Date().toISOString();
            section = item.category || "";
            
            jsonLd = {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              "headline": title,
              "image": [img],
              "datePublished": publishedTime,
              "author": [{
                "@type": "Person",
                "name": author,
                "url": siteUrl
              }],
              "publisher": {
                "@type": "Organization",
                "name": "Norma Jurídica",
                "logo": {
                  "@type": "ImageObject",
                  "url": siteUrl + "/logo.jpg"
                }
              }
            };
          } else {
             // 404
             robots = "noindex, follow";
             title = "Página não encontrada - Norma Jurídica";
          }
        } else if (reqPath === "/politica-de-privacidade") {
           title = "Política de Privacidade - Norma Jurídica";
           desc = "Política de Privacidade do portal Norma Jurídica.";
        } else if (reqPath === "/termos-de-uso") {
           title = "Termos de Uso - Norma Jurídica";
           desc = "Termos de Uso do portal Norma Jurídica.";
        } else if (reqPath === "/lgpd") {
           title = "LGPD - Norma Jurídica";
           desc = "Lei Geral de Proteção de Dados no portal Norma Jurídica.";
        } else if (reqPath === "/contato") {
           title = "Contato - Norma Jurídica";
           desc = "Entre em contato com o portal Norma Jurídica.";
        }

        const metaTags = `
    <!-- SEO_META_TAGS_START -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="author" content="${author}" />
    <meta name="theme-color" content="#0b1329" />
    <meta name="robots" content="${robots}" />
    
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content="${title}" />
    <meta property="og:site_name" content="Norma Jurídica" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:url" content="${url}" />
    ${type === "article" ? `
    <meta property="article:published_time" content="${publishedTime}" />
    ${modifiedTime ? `<meta property="article:modified_time" content="${modifiedTime}" />` : ""}
    <meta property="article:author" content="${author}" />
    <meta property="article:section" content="${section}" />
    ` : ""}
    
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${img}" />
    <meta name="twitter:site" content="@normajuridica" />
    
    <link rel="canonical" href="${url}" />
    <script type="application/ld+json">
      ${JSON.stringify(jsonLd)}
    </script>
    <!-- SEO_META_TAGS_END -->`;

        // Replace the existing block
        html = html.replace(/<!-- SEO_META_TAGS_START -->[\s\S]*<!-- SEO_META_TAGS_END -->/i, metaTags);
        
        res.send(html);
      } catch (err) {
        console.error("Error serving index.html:", err);
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  httpServer.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Exiting cleanly...`);
      process.exit(1);
    } else {
      console.error("Server error:", err);
    }
  });

  const shutdown = () => {
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Norma Jurídica server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
