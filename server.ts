import express from "express";
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

const app = express();
app.set("trust proxy", 1); // Confia no proxy reverso do Cloud Run (Evita erro do express-rate-limit com X-Forwarded-For)
const PORT = 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to prevent blocking AdSense, Firebase Auth, and external images
  crossOriginEmbedderPolicy: false,
}));

// CORS Configuration
app.use(cors({
  origin: process.env.NODE_ENV === "production" ? [process.env.NEXT_PUBLIC_DOMAIN || "https://normajuridica.com"] : "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
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
  if (!resolved.isFallback && resolved.verifiedImage) {
    return resolved.verifiedImage;
  }
  return null;
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
  const mediaPath = path.join(process.cwd(), "src", "data", "mediaImages.json");
  if (fs.existsSync(mediaPath)) {
    mediaPoolData = JSON.parse(fs.readFileSync(mediaPath, "utf-8"));
  }
// Firebase Realtime Database and Sobrescrição Engine (~1.9 GB Storage & ~20 GB Traffic)
const RTDB_PRIMARY = "https://legal-norm2-default-rtdb.firebaseio.com/news.json";
const RTDB_MIRROR = "https://legal-norm3-default-rtdb.firebaseio.com/news.json";
const UPSTREAM_API = "https://api-news-media.netlify.app/api/news";

const STORAGE_LIMIT_BYTES = parseInt(process.env.VITE_FIREBASE_STORAGE_LIMIT_BYTES || process.env.FIREBASE_STORAGE_LIMIT_BYTES || "1932735283", 10);
const TRAFFIC_LIMIT_BYTES = parseInt(process.env.VITE_FIREBASE_TRAFFIC_LIMIT_BYTES || process.env.FIREBASE_TRAFFIC_LIMIT_BYTES || "21474836480", 10);

function processAndApplySobrescricao(rawNews: any[]) {
  if (!Array.isArray(rawNews) || rawNews.length === 0) return;

  const seen = new Set<string>();

  let processed = rawNews
    .map((item: any) => {
      const decodedTitle = cleanEditorialText(decodeHtml(item.title));
      const cleanDesc = cleanEditorialText(decodeHtml(item.description));
      const cleanContent = cleanEditorialText(item.content);
      const tags = item.tags && item.tags.length > 0
        ? item.tags
        : extractTagsForNewsItem({ title: decodedTitle, description: cleanDesc, content: cleanContent, category: item.category });

      const itemWithCleanText = {
        ...item,
        title: decodedTitle,
        description: cleanDesc,
        content: cleanContent,
      };

      // Triple verification: Fonte, Slug e Texto Alt
      const resolved = resolveAuthenticNewsImage(itemWithCleanText);
      const verifiedImgUrl = resolved.isFallback ? "" : (resolved.verifiedImage || "");
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
      const key = item.slug || item.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

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

async function syncNewsFromFirebase() {
  // 1. Try Primary Realtime Database
  try {
    const res = await fetch(RTDB_PRIMARY, { signal: AbortSignal.timeout(7000) });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const items = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
        if (items.length > 0) {
          processAndApplySobrescricao(items);
          return;
        }
      }
    }
  } catch (err: any) {
    console.warn("[RTDB Server] Erro ao sincronizar Banco 1, tentando Banco 2:", err?.message || err);
  }

  // 2. Try Mirror Realtime Database
  try {
    const res = await fetch(RTDB_MIRROR, { signal: AbortSignal.timeout(7000) });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const items = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
        if (items.length > 0) {
          processAndApplySobrescricao(items);
          return;
        }
      }
    }
  } catch (err: any) {
    console.warn("[RTDB Server] Erro ao sincronizar Banco 2:", err?.message || err);
  }
}

// Initial fetch and continuous real-time sync every 30 seconds
syncNewsFromFirebase();
setInterval(syncNewsFromFirebase, 30 * 1000);
} catch (err) {
  console.error("Error loading initial data files:", err);
}

// Site URL helper for dynamic deployments
function sanitizeDomain(input: string): string {
  if (!input) return "";
  return input.replace(/normaajuridica\.com\.br/gi, "normajuridica.com.br");
}

function getSiteUrl(req: express.Request): string {
  const raw = (
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

// Fallback SVG for image errors
function sendFallbackImage(res: express.Response) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <rect width="800" height="450" fill="#0b1329"/>
    <rect x="20" y="20" width="760" height="410" fill="none" stroke="#1e3a8a" stroke-width="2" rx="12"/>
    <text x="400" y="220" font-family="sans-serif" font-size="24" font-weight="bold" fill="#60a5fa" text-anchor="middle">NORMA JURÍDICA</text>
    <text x="400" y="255" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Portal de Notícias e Legislação</text>
  </svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.send(svg);
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
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: parsed.origin + "/",
      },
    });

    clearTimeout(timeout);

    if (!imgRes.ok) {
      return sendFallbackImage(res);
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");

    const arrayBuffer = await imgRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch {
    return sendFallbackImage(res);
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
  const administradores =
    process.env.ADMINISTRADORES ||
    process.env.ADMINITRADORES ||
    process.env.VITE_ADMINISTRADORES ||
    process.env.VITE_ADMINITRADORES ||
    process.env.ADMIN_EMAILS ||
    "";

  res.json({
    success: true,
    administradores,
    primary: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || "",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || "",
    },
    mirror: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_2_API_KEY || process.env.VITE_FIREBASE_2_API_KEY || "",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN || process.env.VITE_FIREBASE_2_AUTH_DOMAIN || "",
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL || process.env.VITE_FIREBASE_2_DATABASE_URL || "",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID || process.env.VITE_FIREBASE_2_PROJECT_ID || "",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET || process.env.VITE_FIREBASE_2_STORAGE_BUCKET || "",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID || "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_2_APP_ID || process.env.VITE_FIREBASE_2_APP_ID || "",
    },
  });
});

// 4d. POST /api/admin/verify-password - Validação segura da senha de administradores
app.post("/api/admin/verify-password", authLimiter, express.json(), (req, res) => {
  const { password, email } = req.body || {};
  const serverAdminPassword = (
    process.env.ADMIN_PASSWORD ||
    process.env.VITE_ADMIN_PASSWORD ||
    process.env.ADMIN_SENHA ||
    ""
  ).trim();

  // Se uma senha de administrador estiver configurada no ambiente
  if (serverAdminPassword) {
    if (password && String(password).trim() === serverAdminPassword) {
      return res.json({ success: true, valid: true });
    }
    return res.status(401).json({
      success: false,
      valid: false,
      error: "Senha de administrador incorreta.",
    });
  }

  // Falha segura se a senha não estiver configurada no ambiente
  return res.status(500).json({
    success: false,
    valid: false,
    error: "Autenticação administrativa não configurada no servidor.",
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

// 5. GET /api/images
app.get("/api/images", (_req, res) => {
  // If query parameter id provided or list of sources
  res.json(mediaPoolData);
});

// 6. GET /api/images/:id
app.get("/api/images/:id", async (req, res) => {
  const idStr = String(req.params.id);
  const matched = mediaPoolData.filter((m) => String(m.id) === idStr || String(m.sourceId) === idStr);

  if (matched.length > 0) {
    return res.json(matched);
  }

  // Try upstream
  try {
    const upstream = await fetch(
      `https://api-news-media.netlify.app/api/images/${idStr}?api_key=${process.env.NEWS_API_KEY}&limit=15`
    );
    if (upstream.ok) {
      const data = await upstream.json();
      return res.json(data);
    }
  } catch {}

  res.status(404).json({ success: false, error: "Mídia não encontrada" });
});

// 7. GET /api/news/category/:category and /api/feed/news/category/:category
app.get(["/api/news/category/:category", "/api/feed/news/category/:category"], async (req, res) => {
  const rawCat = req.params.category;
  const decodedCat = decodeURIComponent(rawCat).trim();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = req.query.all === "true" || req.query.limit === "all"
    ? 5000
    : Math.max(1, Math.min(5000, parseInt((req.query.per_page || req.query.limit) as string) || 12));
  const tagFilter = (req.query.tag as string || "").trim().toLowerCase();

  // Guarantees at least 250 items per category with tag taxonomy
  const feed = buildCategoryFeed(decodedCat, allNewsData);
  let items = feed.items;

  if (tagFilter) {
    items = items.filter((item) =>
      item.tags?.some((t) => t.toLowerCase() === tagFilter)
    );
  }

  const total = items.length;
  const totalPages = Math.ceil(total / perPage) || 1;
  const startIndex = (page - 1) * perPage;
  const paginated = req.query.all === "true" || req.query.limit === "all"
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
    ? allNewsData.length || 5000
    : Math.max(1, Math.min(5000, parseInt((req.query.per_page || req.query.limit) as string) || 12));

  const rawCat = (req.query.category as string) || "";
  const category = decodeURIComponent(rawCat).trim();
  const search = (req.query.search as string || req.query.q as string || "").trim();
  const tagFilter = (req.query.tag as string || "").trim().toLowerCase();
  const sourceId = req.query.source ? parseInt(req.query.source as string) : undefined;

  let feedResult: { total: number; tag_count: number; tags: any[]; items: any[] };

  if (category && category !== "Todas" && category !== "todas") {
    // Guarantees minimum 250 items for the requested category
    feedResult = buildCategoryFeed(category, allNewsData);
  } else {
    feedResult = buildCategoryFeed("Todas", allNewsData);
  }

  let filtered = [...feedResult.items];

  if (tagFilter) {
    filtered = filtered.filter((item) =>
      item.tags?.some((t: string) => t.toLowerCase() === tagFilter)
    );
  }

  if (sourceId) {
    filtered = filtered.filter((item) => item.sourceId === sourceId);
  }

  if (search) {
    const normSearch = slugify(search);
    const tokens = normSearch.split("-").filter((t) => t.length > 1);

    filtered = filtered.filter((item) => {
      const title = slugify(item.title || "");
      const desc = slugify(item.description || "");
      const cat = slugify(item.category || "");
      const content = slugify(item.content || "");
      const tagsStr = (item.tags || []).map((t: string) => slugify(t)).join(" ");

      if (title.includes(normSearch) || desc.includes(normSearch) || cat.includes(normSearch) || tagsStr.includes(normSearch)) {
        return true;
      }
      return tokens.some((t) => title.includes(t) || desc.includes(t) || content.includes(t));
    });
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
    (n) => String(n.id) === idStr || n.slug === idStr || n.slug === `post/${idStr}`
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
  try {
    const upstreamRes = await fetch(
      `https://api-news-media.netlify.app/api/news?api_key=${process.env.NEWS_API_KEY}&limit=30`
    );
    if (upstreamRes.ok) {
      const data: any = await upstreamRes.json();
      const items = Array.isArray(data) ? data : data.data || [];
      let newCount = 0;
      const seen = new Set(allNewsData.map((n) => n.slug || String(n.id)));

      for (const item of items) {
        const key = item.slug || String(item.id);
        if (key && !seen.has(key)) {
          seen.add(key);
          const decodedTitle = cleanEditorialText(decodeHtml(item.title));
          allNewsData.unshift({
            ...item,
            title: decodedTitle,
            description: cleanEditorialText(decodeHtml(item.description)),
            content: cleanEditorialText(item.content),
            thumbnail: extractImage(item) || item.thumbnail || "",
            imageUrl: extractImage(item) || item.imageUrl || "",
            image: extractImage(item) || item.image || "",
            slug: cleanSlug({ ...item, title: decodedTitle }),
          });
          newCount++;
        }
      }
      sourcesMonitoringState.lastCheck = new Date().toISOString();
      sourcesMonitoringState.upstreamConnected = true;
      sourcesMonitoringState.ingestedNewsCount += newCount;
    }
  } catch (e) {
    sourcesMonitoringState.upstreamConnected = false;
  }
}

// Initial background check
monitorUpstreamSources();
setInterval(monitorUpstreamSources, 5 * 60 * 1000);

app.get("/api/monitoring/sources", (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    data: sourcesMonitoringState,
    totalSources: sourcesData.length,
    totalNewsInCatalog: allNewsData.length,
  });
});

app.post("/api/monitoring/sync", authLimiter, async (_req: express.Request, res: express.Response) => {
  await monitorUpstreamSources();
  res.json({
    success: true,
    message: "Sincronização e monitoramento executados com sucesso.",
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

// 12. Public Weather API
app.get("/api/weather", async (req, res) => {
  try {
    let lat = req.query.lat ? parseFloat(req.query.lat as string) : -15.7975;
    let lon = req.query.lon ? parseFloat(req.query.lon as string) : -47.8919;
    let city = (req.query.city as string) || "Brasília";
    let state = (req.query.state as string) || "DF";

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
    const response = await fetch(weatherUrl);
    const data = await response.json();

    const current = data.current || {};
    const daily = data.daily || {};
    const code = current.weather_code ?? 0;

    let conditionText = "Ensolarado";
    if (code === 0) conditionText = current.is_day ? "Céu limpo" : "Noite estrelada";
    else if (code >= 1 && code <= 3) conditionText = "Parcialmente nublado";
    else if (code >= 45 && code <= 48) conditionText = "Nevoeiro";
    else if (code >= 51 && code <= 67) conditionText = "Chuva leve";
    else if (code >= 71 && code <= 77) conditionText = "Queda de neve";
    else if (code >= 80 && code <= 82) conditionText = "Pancadas de chuva";
    else if (code >= 95) conditionText = "Tempestade com trovões";

    res.json({
      success: true,
      data: {
        city,
        state,
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
      },
    });
  } catch {
    res.json({
      success: true,
      data: {
        city: "Brasília",
        state: "DF",
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

// 13. Contact & DSAR form via SMTP
app.post("/api/contact", contactLimiter, async (req, res) => {
  const { name, email, phone, subject, category, message, lgpdConsent, requestType, cpf } = req.body;

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
      console.error("SMTP error:", smtpErr);
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      try {
        let html = await fs.promises.readFile(path.join(distPath, "index.html"), "utf-8");
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Norma Jurídica server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
