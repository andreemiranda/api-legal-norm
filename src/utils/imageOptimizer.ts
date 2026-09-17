// Utility to extract, optimize and render news images exclusively from API / content
// STRICT RULE: News thumbnails and highlights must NEVER use SVG fallbacks or placeholder graphics.
// If an article contains ANY image in its content or fields, that image MUST be extracted and displayed.

import { NewsItem } from "../types";
import { verifyNewsImage, resolveAuthenticNewsImage, extractHostname } from "./imageVerification";

/**
 * High-quality real editorial photographs for safe journalistic fallback.
 * Strictly photographs — NEVER SVG graphics.
 */
export const EDITORIAL_FALLBACK_PHOTOS: Record<string, string[]> = {
  "direito": [
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1453733197781-70d2df6f5466?auto=format&fit=crop&w=1200&q=80",
  ],
  "legislacao": [
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80",
  ],
  "economia": [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
  ],
  "tocantins": [
    "https://atitudeto.com.br/wp-content/uploads/2026/09/941c721f-e315-4705-b048-26ec86a5159c.jpeg",
    "https://jornalobico.com.br/wp-content/uploads/2026/07/3c8226e9-1cf6-49a9-8c3c-44417fb95879.jpeg",
  ],
  "default": [
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80",
  ],
};

/**
 * Returns a real photographic fallback based on category or item seed.
 * NEVER returns an SVG data URI!
 */
export function getEditorialFallbackPhoto(category?: string, seed?: string | number): string {
  const normCat = (category || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let list = EDITORIAL_FALLBACK_PHOTOS["default"];
  if (normCat.includes("direit") || normCat.includes("jurid") || normCat.includes("judic") || normCat.includes("tribun")) {
    list = EDITORIAL_FALLBACK_PHOTOS["direito"];
  } else if (normCat.includes("legis") || normCat.includes("const") || normCat.includes("governo") || normCat.includes("polit")) {
    list = EDITORIAL_FALLBACK_PHOTOS["legislacao"];
  } else if (normCat.includes("econ") || normCat.includes("finan") || normCat.includes("tribut")) {
    list = EDITORIAL_FALLBACK_PHOTOS["economia"];
  } else if (normCat.includes("tocantins") || normCat.includes("palmas")) {
    list = EDITORIAL_FALLBACK_PHOTOS["tocantins"];
  }

  let num = 0;
  if (typeof seed === "number") num = Math.abs(seed);
  else if (typeof seed === "string") {
    for (let i = 0; i < seed.length; i++) num += seed.charCodeAt(i);
  }
  return list[num % list.length] || list[0];
}

/**
 * Replaced: NEVER returns SVG. Returns an authentic editorial photo URL.
 * Maintained for backwards compatibility across existing callers.
 */
export function createEditorialFallbackSvg(category: string = "Notícia", title?: string): string {
  return getEditorialFallbackPhoto(category, title);
}

/**
 * Checks if a string is a valid external or API image URL.
 * Rejects technical assets and SVGs.
 */
export function isValidApiImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  // Reject SVGs and data URI SVGs
  if (lower.startsWith("data:image/svg") || lower.endsWith(".svg") || lower.includes(".svg?")) {
    return false;
  }

  // Reject local technical assets
  if (
    trimmed.includes("logo.jpg") ||
    trimmed.includes("favicon") ||
    trimmed.includes("og-image") ||
    trimmed === "/logo.jpg" ||
    lower.includes("pixel.gif") ||
    lower.includes("1x1") ||
    lower.includes("spinner") ||
    lower.includes("loading.gif") ||
    lower.includes("blank.gif") ||
    lower.includes("avatar") ||
    lower.includes("submit-spin")
  ) {
    return false;
  }

  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("//");
}

/**
 * Normalizes URL for duplicate comparison
 */
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
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * Transforms an image URL to a clean directly-fetchable or proxied URL.
 * NEVER returns an SVG data URI!
 */
export function toOptimizedImage(url?: string | null, category: string = "Notícia", title?: string): string {
  if (!url || typeof url !== "string") {
    return getEditorialFallbackPhoto(category, title);
  }

  const trimmed = url.trim();
  if (!trimmed || !isValidApiImageUrl(trimmed)) {
    return getEditorialFallbackPhoto(category, title);
  }

  // If already relative root or proxy
  if (trimmed.startsWith("/next_imagem?url=") || trimmed.startsWith("/next_image?url=")) {
    return trimmed;
  }

  // Return direct URL with protocol
  if (trimmed.startsWith("//")) {
    return "https:" + trimmed;
  }

  return trimmed;
}

export const getProxyImageUrl = toOptimizedImage;

/**
 * Helper to extract all images from an HTML string (src, data-src, data-lazy-src, data-original, srcset, markdown, direct image links)
 */
function extractImagesFromHtml(html: string, addCandidate: (url: string) => void) {
  if (!html || typeof html !== "string") return;

  // 1. Match <img ...> with src, data-src, data-original, data-lazy-src
  const imgTagRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']/gi;
  let m;
  while ((m = imgTagRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 2. Match unquoted <img src=...>
  const unquotedRegex = /<img[^>]+src=([^\s"'>]+)/gi;
  while ((m = unquotedRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 3. Match srcset
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRegex.exec(html)) !== null) {
    const parts = m[1].split(",");
    for (const part of parts) {
      const u = part.trim().split(/\s+/)[0];
      if (u) addCandidate(u);
    }
  }

  // 4. Match markdown images ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
  while ((m = mdRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 5. Match direct image URLs in text (.webp, .jpg, .jpeg, .png, .avif)
  const directUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:webp|jpe?g|png|avif)(?:\?[^\s"'<>]*)?)/gi;
  while ((m = directUrlRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }
}

/**
 * Extracts ALL unique authentic image URLs found across any content or metadata field of a news item.
 */
export function extractAllItemImages(item?: Partial<NewsItem> | null): string[] {
  if (!item) return [];
  const found: string[] = [];
  const seenNorm = new Set<string>();

  const addCandidate = (raw?: string | null) => {
    if (!raw || typeof raw !== "string") return;
    let candidate = raw.trim();
    if (candidate.startsWith("//")) candidate = "https:" + candidate;
    if (!isValidApiImageUrl(candidate)) return;

    const norm = normalizeImageUrl(candidate);
    if (norm && !seenNorm.has(norm)) {
      seenNorm.add(norm);
      found.push(candidate);
    }
  };

  // 1. Content HTML (first priority: journalist's embedded article photos)
  if (item.content) {
    extractImagesFromHtml(item.content, addCandidate);
  }

  // 2. Direct fields from API/RSS
  addCandidate(item.thumbnail);
  addCandidate(item.imageUrl);
  addCandidate(item.image);
  addCandidate((item as any)?.mediaUrl);

  // 3. Enclosure
  const enc = (item as any)?.enclosure;
  if (enc) {
    if (typeof enc === "string") addCandidate(enc);
    else if (typeof enc === "object" && enc.url) addCandidate(enc.url);
  }

  // 4. Description HTML
  if (item.description) {
    extractImagesFromHtml(item.description, addCandidate);
  }

  return found;
}

/**
 * Extracts the featured image, candidate chain, and secondary images from the post.
 * Implements ANY image from the news content without SVG fallback.
 */
export function extractPostImages(item: Partial<NewsItem>): {
  featuredImage: string;
  candidates: string[];
  otherImages: string[];
  verifiedAlt: string;
} {
  const cleanTitle = (item.title || "Notícia")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .trim();

  // Extract all authentic images from content and metadata
  const images = extractAllItemImages(item);

  // If no images could be found in the article, fallback to a real journalistic photograph (NEVER SVG!)
  if (images.length === 0) {
    const photoFallback = getEditorialFallbackPhoto(item.category, item.id || item.title);
    return {
      featuredImage: photoFallback,
      candidates: [photoFallback],
      otherImages: [],
      verifiedAlt: cleanTitle,
    };
  }

  const featuredImage = images[0];
  const candidates = images;
  const otherImages = images.slice(1);

  return {
    featuredImage,
    candidates,
    otherImages,
    verifiedAlt: cleanTitle,
  };
}

/**
 * Extracts a featured image from any available field or content in the news item.
 * NEVER returns an SVG data URI!
 */
export function getPostThumbnail(item: Partial<NewsItem>): string {
  const { featuredImage } = extractPostImages(item);
  return featuredImage;
}

/**
 * Processes post HTML content:
 * - Removes "da redação" text/paragraphs
 * - Guarantees referrerpolicy="no-referrer" and loading="lazy" on all <img> tags
 * - NEVER deletes valid images from the news body!
 */
export function processPostContent(
  rawHtml?: string,
  featuredImageUrl?: string,
  newsItem?: Partial<NewsItem>
): string {
  if (!rawHtml) return "";

  // Remove "da redação" text, headers, and paragraphs
  let html = rawHtml
    .replace(/<p[^>]*>\s*(da\s+redação|da\s+redacao|redação|redacao)\s*<\/p>/gi, "")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/i, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .replace(/\bRedação Norma Jurídica\b/gi, "Norma Jurídica");

  // Ensure all <img> tags have referrerpolicy="no-referrer" and loading="lazy"
  // Keep all images intact!
  html = html.replace(/<img([^>]+)>/gi, (match, attrs) => {
    let cleanAttrs = attrs;
    if (!cleanAttrs.includes("referrerpolicy")) {
      cleanAttrs += ` referrerpolicy="no-referrer"`;
    }
    if (!cleanAttrs.includes("loading")) {
      cleanAttrs += ` loading="lazy"`;
    }
    return `<img${cleanAttrs}>`;
  });

  // Clean empty figures or excessive breaks
  html = html
    .replace(/<figure[^>]*>\s*<\/figure>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />")
    .trim();

  return html;
}
