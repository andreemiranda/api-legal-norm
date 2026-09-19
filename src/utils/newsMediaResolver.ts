import fs from "fs";
import path from "path";
import { NewsItem } from "../types";
import { isValidApiImageUrl } from "./imageOptimizer";

export interface MediaCatalogItem {
  id?: number | string;
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  imageUrl?: string;
  mediaUrl?: string;
  sourceId?: number | string;
  category?: string;
  site?: string;
  raw?: {
    alt_text?: string;
    media_details?: any;
    [key: string]: any;
  };
}

let inMemoryCatalog: MediaCatalogItem[] = [];
let slugToMediaMap = new Map<string, MediaCatalogItem[]>();
let categoryToMediaMap = new Map<string, MediaCatalogItem[]>();
let sourceToMediaMap = new Map<string, MediaCatalogItem[]>();

export function normalizeImageUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  let clean = url.trim();
  try {
    if (clean.includes("/next_imagem?url=") || clean.includes("/next_image?url=")) {
      const parsed = new URL(clean, "http://localhost");
      clean = parsed.searchParams.get("url") || clean;
    }
  } catch {}

  return clean
    .split("?")[0]
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function deduplicateImageList(urls: (string | undefined | null)[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of urls) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || !isValidApiImageUrl(trimmed)) continue;

    const norm = normalizeImageUrl(trimmed);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(trimmed);
    }
  }

  return result;
}

function extractSlug(urlOrStr?: string | null): string {
  if (!urlOrStr || typeof urlOrStr !== "string") return "";
  const clean = urlOrStr.split("?")[0].replace(/\/+$/, "");
  const parts = clean.split("/").filter(Boolean);
  return parts.pop() || "";
}

function reindexCatalog() {
  slugToMediaMap.clear();
  categoryToMediaMap.clear();
  sourceToMediaMap.clear();

  for (const m of inMemoryCatalog) {
    if (!m.imageUrl) continue;

    // 1. Index by parent post link / slug
    if (m.link) {
      const cleanLink = m.link.split("?")[0].replace(/\/+$/, "");
      const parts = cleanLink.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const parentSlug = parts[parts.length - 2].toLowerCase();
        if (parentSlug.length > 3) {
          if (!slugToMediaMap.has(parentSlug)) slugToMediaMap.set(parentSlug, []);
          slugToMediaMap.get(parentSlug)!.push(m);
        }
      }
    }

    // 2. Index by alt text slug
    const alt = (m.raw?.alt_text || "").toLowerCase().trim();
    if (alt.length > 4) {
      const altSlug = alt.replace(/\s+/g, "-");
      if (!slugToMediaMap.has(altSlug)) slugToMediaMap.set(altSlug, []);
      slugToMediaMap.get(altSlug)!.push(m);
    }

    // 3. Index by category
    const cat = (m.category || "Notícias").trim();
    if (!categoryToMediaMap.has(cat)) categoryToMediaMap.set(cat, []);
    categoryToMediaMap.get(cat)!.push(m);

    // 4. Index by source
    const srcKey = String(m.sourceId || m.site || "").trim();
    if (srcKey) {
      if (!sourceToMediaMap.has(srcKey)) sourceToMediaMap.set(srcKey, []);
      sourceToMediaMap.get(srcKey)!.push(m);
    }
  }
}

export function initMediaCatalog(initialList?: MediaCatalogItem[]): void {
  if (Array.isArray(initialList) && initialList.length > 0) {
    inMemoryCatalog = initialList;
    reindexCatalog();
    return;
  }

  const possiblePaths = [
    path.join(process.cwd(), "src", "data", "mediaCatalog.json"),
    path.join(process.cwd(), "dist", "data", "mediaCatalog.json"),
    path.join(process.cwd(), "data", "mediaCatalog.json"),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryCatalog = parsed;
          reindexCatalog();
          return;
        }
      }
    } catch {}
  }
}

export function extractImagesFromHtml(html?: string | null): string[] {
  if (!html || typeof html !== "string") return [];
  const found: string[] = [];

  // Match <img> tags across various attributes
  const attrRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy-src|data-hi-res-src|data-actualsrc|data-default-src|data-url)=["']([^"']+)["']/gi;
  let m;
  while ((m = attrRegex.exec(html)) !== null) {
    if (m[1]) found.push(m[1]);
  }

  // Match unquoted <img src=...>
  const unquotedRegex = /<img[^>]+src=([^\s"'>]+)/gi;
  while ((m = unquotedRegex.exec(html)) !== null) {
    if (m[1]) found.push(m[1]);
  }

  // Match markdown ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
  while ((m = mdRegex.exec(html)) !== null) {
    if (m[1]) found.push(m[1]);
  }

  // Match direct image URLs in text (.jpg, .jpeg, .png, .webp, .avif, .gif)
  const directUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|avif|gif|bmp|tiff|jfif|heic)(?:\?[^\s"'<>]*)?)/gi;
  while ((m = directUrlRegex.exec(html)) !== null) {
    if (m[1]) found.push(m[1]);
  }

  return found;
}

/**
 * Resolves authentic images for a news item, guaranteeing at least one image
 * and preserving all non-repeated distinct images.
 */
export function resolveNewsMedia(item: Partial<NewsItem>): {
  primaryImage: string;
  images: string[];
  verifiedAlt: string;
} {
  const officialTitle = (item.title || "Notícia - Norma Jurídica")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .trim();

  const rawCandidates: string[] = [];

  // 1. Direct item fields
  if (item.thumbnail) rawCandidates.push(item.thumbnail);
  if (item.imageUrl) rawCandidates.push(item.imageUrl);
  if (item.image) rawCandidates.push(item.image);
  if (Array.isArray(item.images)) rawCandidates.push(...item.images);
  if ((item as any)?.mediaUrl) rawCandidates.push((item as any).mediaUrl);
  if ((item as any)?.photo) rawCandidates.push((item as any).photo);
  if ((item as any)?.cover) rawCandidates.push((item as any).cover);

  // 2. Enclosure
  const enc = (item as any)?.enclosure;
  if (enc) {
    if (typeof enc === "string") rawCandidates.push(enc);
    else if (typeof enc === "object" && enc.url) rawCandidates.push(enc.url);
  }

  // 3. Embedded images in content and description
  if (item.content) {
    rawCandidates.push(...extractImagesFromHtml(item.content));
  }
  if (item.description) {
    rawCandidates.push(...extractImagesFromHtml(item.description));
  }

  // 4. Match against in-memory media catalog
  if (inMemoryCatalog.length > 0) {
    const postSlug = extractSlug(item.link || item.slug).toLowerCase();
    const cleanTitle = officialTitle.toLowerCase();

    // Direct slug match
    if (postSlug && slugToMediaMap.has(postSlug)) {
      const matches = slugToMediaMap.get(postSlug)!;
      matches.forEach((m) => {
        if (m.imageUrl) rawCandidates.push(m.imageUrl);
      });
    }

    // Title / alt matching
    if (rawCandidates.length === 0 && cleanTitle.length > 10) {
      for (const m of inMemoryCatalog) {
        const alt = (m.raw?.alt_text || "").toLowerCase().trim();
        const mTitle = (m.title || "").toLowerCase().trim();
        if (alt && alt.length > 8 && (cleanTitle.includes(alt) || postSlug.includes(alt.replace(/\s+/g, "-")))) {
          if (m.imageUrl) rawCandidates.push(m.imageUrl);
          break;
        }
        if (mTitle && mTitle.length > 15 && cleanTitle.includes(mTitle)) {
          if (m.imageUrl) rawCandidates.push(m.imageUrl);
          break;
        }
      }
    }
  }

  // 5. Fallback if still empty: guarantee topic-relevant image from source or category pool
  const testValid = deduplicateImageList(rawCandidates);
  if (testValid.length === 0 && inMemoryCatalog.length > 0) {
    const srcKey = String(item.sourceId || item.sourceSite || "");
    const srcPool = sourceToMediaMap.get(srcKey);
    const catPool = categoryToMediaMap.get(item.category || "");
    const pool = (srcPool && srcPool.length > 0) ? srcPool : (catPool && catPool.length > 0) ? catPool : inMemoryCatalog;

    let hash = 0;
    for (let i = 0; i < officialTitle.length; i++) {
      hash = (hash * 31 + officialTitle.charCodeAt(i)) >>> 0;
    }

    // Try primary pool
    let foundImg = "";
    for (let attempt = 0; attempt < pool.length; attempt++) {
      const chosen = pool[(hash + attempt) % pool.length];
      if (chosen?.imageUrl && isValidApiImageUrl(chosen.imageUrl)) {
        foundImg = chosen.imageUrl;
        break;
      }
    }

    // If still empty, try complete inMemoryCatalog
    if (!foundImg && inMemoryCatalog.length > 0) {
      for (let attempt = 0; attempt < inMemoryCatalog.length; attempt++) {
        const chosen = inMemoryCatalog[(hash + attempt) % inMemoryCatalog.length];
        if (chosen?.imageUrl && isValidApiImageUrl(chosen.imageUrl)) {
          foundImg = chosen.imageUrl;
          break;
        }
      }
    }

    if (foundImg) {
      rawCandidates.push(foundImg);
    }
  }

  // Deduplicate all candidate images (keep 1 if repeated, keep all distinct)
  const distinctImages = deduplicateImageList(rawCandidates);
  const primaryImage = distinctImages[0] || "";

  return {
    primaryImage,
    images: distinctImages,
    verifiedAlt: officialTitle,
  };
}

export function getMediaCatalogCount(): number {
  return inMemoryCatalog.length;
}
