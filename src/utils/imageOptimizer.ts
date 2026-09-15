// Utility to extract, optimize and render news images exclusively from API / content
// STRICT RULE: News thumbnails and highlights must NEVER use images from the /public folder (such as /logo.jpg)

import { NewsItem } from "../types";
import { verifyNewsImage, resolveAuthenticNewsImage } from "./imageVerification";

/**
 * Creates an elegant SVG data URI as an editorial fallback placeholder
 * featuring the category and legal scales of justice.
 * Never references files from the /public folder.
 */
export function createEditorialFallbackSvg(category: string = "Notícia", title?: string): string {
  const cat = (category || "Notícia").toUpperCase();
  const cleanTitle = (title || "Norma Jurídica")
    .slice(0, 45)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1329"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bgGrad)"/>
  <rect x="20" y="20" width="760" height="410" rx="14" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="6 6"/>
  <g transform="translate(370, 130) scale(2.6)" stroke="url(#goldGrad)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="M7 21h10"/>
    <path d="M12 3v18"/>
    <path d="M3 7h18"/>
  </g>
  <rect x="280" y="255" width="240" height="32" rx="6" fill="#1d4ed8"/>
  <text x="400" y="276" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">${cat}</text>
  <text x="400" y="320" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#f8fafc" text-anchor="middle">${cleanTitle}</text>
  <text x="400" y="348" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">NORMA JURÍDICA • EDIÇÃO NACIONAL</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Checks if a string is a valid external or API image URL
 * Rejects any /logo.jpg, /favicon, /og-image, or empty strings
 */
export function isValidApiImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (
    trimmed.includes("logo.jpg") ||
    trimmed.includes("favicon") ||
    trimmed.includes("og-image") ||
    trimmed === "/logo.jpg"
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
 * Transforms an image URL to the optimized /next_imagem pattern
 * Supports relative, internal, and external images
 */
export function toOptimizedImage(url?: string | null, category: string = "Notícia", title?: string): string {
  if (!url || typeof url !== "string") {
    return createEditorialFallbackSvg(category, title);
  }

  const trimmed = url.trim();
  if (!trimmed || !isValidApiImageUrl(trimmed)) {
    return createEditorialFallbackSvg(category, title);
  }

  // If already relative root or proxy
  if (trimmed.startsWith("/next_imagem?url=") || trimmed.startsWith("/next_image?url=")) {
    return trimmed;
  }

  // Return direct URL (browsers with referrerpolicy="no-referrer" load smoothly)
  return trimmed;
}

export const getProxyImageUrl = toOptimizedImage;

/**
 * Extracts a featured image, candidate chain, and secondary images from the post.
 * STRICT: Every candidate is validated across Source, Slug, and Alt text to prevent swapped images.
 */
export function extractPostImages(item: Partial<NewsItem>): {
  featuredImage: string;
  candidates: string[];
  otherImages: string[];
  verifiedAlt: string;
} {
  const images: string[] = [];
  const cleanTitle = (item.title || "Notícia")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .trim();

  const addCandidate = (candidate?: string | null, altCandidate?: string | null) => {
    if (candidate && isValidApiImageUrl(candidate)) {
      // Triple verification: Source, Slug, and Alt
      const verification = verifyNewsImage(candidate, item, altCandidate);
      if (verification.valid) {
        const norm = normalizeImageUrl(candidate);
        if (norm && !images.some((img) => normalizeImageUrl(img) === norm)) {
          images.push(candidate.trim());
        }
      }
    }
  };

  // 1. Check content HTML images first (often the most article-specific)
  if (item.content) {
    const matches = item.content.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi);
    for (const match of matches) {
      const tagStr = match[0];
      const src = match[1];
      const altMatch = tagStr.match(/alt=["']([^"']*)["']/i);
      addCandidate(src, altMatch ? altMatch[1] : undefined);
    }
  }

  // 2. Direct API / RSS fields
  addCandidate(item.thumbnail, (item as any)?.imageAlt);
  addCandidate(item.imageUrl, (item as any)?.imageAlt);
  addCandidate(item.image, (item as any)?.imageAlt);

  // 3. Enclosure field
  const enc = (item as any)?.enclosure;
  if (enc) {
    if (typeof enc === "string") {
      addCandidate(enc, cleanTitle);
    } else if (typeof enc === "object" && enc.url) {
      addCandidate(enc.url, enc.title || enc.description || cleanTitle);
    }
  }

  // 4. Extract from description HTML
  if (item.description) {
    const matches = item.description.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi);
    for (const match of matches) {
      const tagStr = match[0];
      const src = match[1];
      const altMatch = tagStr.match(/alt=["']([^"']*)["']/i);
      addCandidate(src, altMatch ? altMatch[1] : undefined);
    }
  }

  // Fallback vector SVG if no images passed the verification
  const fallbackSvg = createEditorialFallbackSvg(item.category || "Notícia", item.title);
  const featuredImage = images[0] || fallbackSvg;
  const candidates = images.length > 0 ? [...images, fallbackSvg] : [fallbackSvg];
  const otherImages = images.slice(1);

  return {
    featuredImage,
    candidates,
    otherImages,
    verifiedAlt: cleanTitle,
  };
}

/**
 * Extracts a featured image or fallback SVG from any available field in the news item
 */
export function getPostThumbnail(item: Partial<NewsItem>): string {
  const { featuredImage } = extractPostImages(item);
  return featuredImage;
}

/**
 * Processes post HTML content:
 * - Removes "da redação" text/paragraphs
 * - Guarantees referrerpolicy="no-referrer" and loading="lazy" on all <img> tags
 * - Removes duplicate images that match the featured image or already appeared in the body
 * - Eliminates any internal public folder image references
 */
export function processPostContent(
  rawHtml?: string,
  featuredImageUrl?: string,
  newsItem?: Partial<NewsItem>
): string {
  if (!rawHtml) return "";

  const seenImages = new Set<string>();
  if (featuredImageUrl) {
    const norm = normalizeImageUrl(featuredImageUrl);
    if (norm) seenImages.add(norm);
  }

  // Remove "da redação" text, headers, and paragraphs
  let html = rawHtml
    .replace(/<p[^>]*>\s*(da\s+redação|da\s+redacao|redação|redacao)\s*<\/p>/gi, "")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/i, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .replace(/\bRedação Norma Jurídica\b/gi, "Norma Jurídica");

  // Rewrite and deduplicate images in <figure>
  html = html.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (figureMatch, inner) => {
    const imgMatch = inner.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch && imgMatch[1]) {
      const src = imgMatch[1];
      if (!isValidApiImageUrl(src)) return "";

      // Check verification if newsItem is provided
      if (newsItem) {
        const altMatch = inner.match(/alt=["']([^"']*)["']/i);
        const verification = verifyNewsImage(src, newsItem, altMatch ? altMatch[1] : undefined);
        if (!verification.valid) return "";
      }

      const norm = normalizeImageUrl(src);
      if (seenImages.has(norm)) {
        return ""; // Strip duplicate figure
      }
      seenImages.add(norm);
      return figureMatch.replace(
        /<img([^>]+)>/i,
        `<img$1 referrerpolicy="no-referrer" loading="lazy">`
      );
    }
    return figureMatch;
  });

  // Rewrite standard <img> tags
  html = html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
    if (!isValidApiImageUrl(src)) return "";

    // Check verification if newsItem is provided
    if (newsItem) {
      const combinedTag = `${before} ${after}`;
      const altMatch = combinedTag.match(/alt=["']([^"']*)["']/i);
      const verification = verifyNewsImage(src, newsItem, altMatch ? altMatch[1] : undefined);
      if (!verification.valid) return "";
    }

    const norm = normalizeImageUrl(src);
    if (seenImages.has(norm)) {
      return ""; // Strip duplicate image
    }
    seenImages.add(norm);
    return `<img${before}src="${src}" referrerpolicy="no-referrer" loading="lazy"${after}>`;
  });

  // Clean empty figures or excessive breaks
  html = html
    .replace(/<figure[^>]*>\s*<\/figure>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />")
    .trim();

  return html;
}
