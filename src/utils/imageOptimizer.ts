// Utility to extract, optimize and render news images exclusively from news article content
// STRICT RULE: Unsplash API, external stock photo APIs, and placeholder fallbacks are STRICTLY REMOVED.
// If an article contains ANY image in its content or fields across diverse formats, that image (1st, 2nd, etc.) is extracted and used.

import { NewsItem } from "../types";
import { verifyNewsImage, extractHostname } from "./imageVerification";

/**
 * Fallback photo helper kept for interface compatibility, but returns empty string.
 * Strictly NO Unsplash or third-party stock photo APIs.
 */
export function getEditorialFallbackPhoto(_category?: string, _seed?: string | number): string {
  return "";
}

/**
 * Maintained for backwards compatibility across existing callers.
 * Strictly NO SVG or external stock photos.
 */
export function createEditorialFallbackSvg(_category: string = "Notícia", _title?: string): string {
  return "";
}

/**
 * Checks if a string is a valid news image URL.
 * Rejects Unsplash, third-party stock APIs, tracking pixels, and SVGs.
 */
export function isValidApiImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  // STRICT RULE: Reject Unsplash and external stock photo domains
  if (lower.includes("unsplash.com") || lower.includes("stockphoto.com") || lower.includes("shutterstock.com") || lower.includes("gettyimages.com")) {
    return false;
  }

  // Reject non-image documents (PDFs, docs)
  if (lower.endsWith(".pdf") || lower.includes(".pdf?") || lower.endsWith(".doc") || lower.endsWith(".docx")) {
    return false;
  }

  // Reject SVGs and data URI SVGs
  if (lower.startsWith("data:image/svg") || lower.endsWith(".svg") || lower.includes(".svg?")) {
    return false;
  }

  // Reject local technical assets and tracking pixels
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

  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("data:image/")
  );
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
 * Strictly returns authentic URL or empty string. NO Unsplash or external fallbacks!
 */
export function toOptimizedImage(url?: string | null, _category: string = "Notícia", _title?: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();
  if (!trimmed || !isValidApiImageUrl(trimmed)) {
    return "";
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
 * Helper to extract all images across diverse formats (.jpg, .jpeg, .png, .webp, .avif, .gif, .bmp, .tiff, .jfif, .heic)
 * from HTML strings, attributes, unquoted tags, srcset, escaped HTML, markdown, and inline CSS.
 */
function extractImagesFromHtml(html: string, addCandidate: (url: string) => void) {
  if (!html || typeof html !== "string") return;

  // 1. Match <img ...> with any image attribute
  const imgTagRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy-src|data-hi-res-src|data-actualsrc|data-default-src|data-url|data-fallback)=["']([^"']+)["']/gi;
  let m;
  while ((m = imgTagRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 2. Match unquoted <img src=...>
  const unquotedRegex = /<img[^>]+src=([^\s"'>]+)/gi;
  while ((m = unquotedRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 3. Match srcset or data-srcset
  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  while ((m = srcsetRegex.exec(html)) !== null) {
    const parts = m[1].split(",");
    for (const part of parts) {
      const u = part.trim().split(/\s+/)[0];
      if (u) addCandidate(u);
    }
  }

  // 4. Match HTML-escaped image tags (&lt;img ... src=&quot;...&quot;)
  const escapedRegex = /&lt;img[^&]+(?:src|data-src)=&quot;([^&]+)&quot;/gi;
  while ((m = escapedRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 5. Match markdown images ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
  while ((m = mdRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 6. Match CSS background-image
  const cssRegex = /url\(["']?(https?:\/\/[^\)"']+)["']?\)/gi;
  while ((m = cssRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 7. Match direct image URLs across diverse formats in text
  const directUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|avif|gif|bmp|tiff|jfif|heic)(?:\?[^\s"'<>]*)?)/gi;
  while ((m = directUrlRegex.exec(html)) !== null) {
    if (m[1]) addCandidate(m[1]);
  }

  // 8. Match CDN media patterns (e.g., Globo s2-g1.glbimg.com)
  const cdnRegex = /(https?:\/\/s2-[a-z0-9]+\.glbimg\.com\/[^\s"'<>]+)/gi;
  while ((m = cdnRegex.exec(html)) !== null) {
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
    if (candidate.startsWith("&quot;") || candidate.endsWith("&quot;")) candidate = candidate.replace(/^&quot;|&quot;$/g, "");
    if (candidate.startsWith("&#39;") || candidate.endsWith("&#39;")) candidate = candidate.replace(/^&#39;|&#39;$/g, "");
    if (candidate.startsWith("//")) candidate = "https:" + candidate;
    candidate = candidate.replace(/&amp;/g, "&");

    if (!isValidApiImageUrl(candidate)) return;

    const norm = normalizeImageUrl(candidate);
    if (norm && !seenNorm.has(norm)) {
      seenNorm.add(norm);
      found.push(candidate);
    }
  };

  // 1. Direct fields from API/RSS
  addCandidate(item.thumbnail);
  addCandidate(item.imageUrl);
  addCandidate(item.image);
  if (Array.isArray(item.images)) {
    for (const img of item.images) {
      addCandidate(img);
    }
  }
  addCandidate((item as any)?.mediaUrl);
  addCandidate((item as any)?.photo);
  addCandidate((item as any)?.cover);

  // 2. Enclosure
  const enc = (item as any)?.enclosure;
  if (enc) {
    if (typeof enc === "string") addCandidate(enc);
    else if (typeof enc === "object" && enc.url) addCandidate(enc.url);
  }

  // 3. Media namespaces
  const mediaContent = (item as any)?.["media:content"];
  if (mediaContent) {
    if (typeof mediaContent === "string") addCandidate(mediaContent);
    else if (typeof mediaContent === "object" && mediaContent.url) addCandidate(mediaContent.url);
  }
  const mediaThumb = (item as any)?.["media:thumbnail"];
  if (mediaThumb) {
    if (typeof mediaThumb === "string") addCandidate(mediaThumb);
    else if (typeof mediaThumb === "object" && mediaThumb.url) addCandidate(mediaThumb.url);
  }

  // 4. Content HTML & Body (journalist's embedded article photos)
  if (item.content) {
    extractImagesFromHtml(item.content, addCandidate);
  }

  // 5. Description HTML
  if (item.description) {
    extractImagesFromHtml(item.description, addCandidate);
  }

  // 6. Encoded content or summary
  if ((item as any)?.["content:encoded"]) {
    extractImagesFromHtml((item as any)["content:encoded"], addCandidate);
  }
  if ((item as any)?.summary) {
    extractImagesFromHtml((item as any).summary, addCandidate);
  }

  return found;
}

/**
 * Extracts the featured image, candidate chain (1st, 2nd, etc.), and secondary images from the post.
 * Strictly uses images from that article's content — NEVER Unsplash or external API fallbacks!
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

  // Extract all authentic images from the article content and metadata
  const images = extractAllItemImages(item);

  // If no images exist in the article content, return empty (STRICT: NO UNSPLASH, NO EXTERNAL FALLBACK)
  if (images.length === 0) {
    return {
      featuredImage: "",
      candidates: [],
      otherImages: [],
      verifiedAlt: cleanTitle,
    };
  }

  // The 1st image is the primary featured image, 2nd is available in candidates[1]
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
 * Strictly returns authentic content image or empty string.
 */
export function getPostThumbnail(item: Partial<NewsItem>): string {
  const { featuredImage } = extractPostImages(item);
  return featuredImage;
}

/**
 * Deduplicates repeated images in news HTML content.
 * Keeps only the first occurrence of an image with the same URL,
 * while preserving all other distinct (non-repeated) images!
 */
export function deduplicateContentImages(html: string): string {
  if (!html || typeof html !== "string") return "";

  const seenUrls = new Set<string>();

  // Helper to extract clean normalized image URL
  const extractCleanUrl = (tag: string): string => {
    const m = tag.match(/(?:src|data-src)=["']([^"']+)["']/i) || tag.match(/src=([^\s>]+)/i);
    return m ? normalizeImageUrl(m[1]) : "";
  };

  // 1. Process figures wrapping images
  let cleaned = html.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (figureMatch, innerContent) => {
    const imgMatch = innerContent.match(/<img[^>]+>/i);
    if (!imgMatch) return figureMatch;

    const normUrl = extractCleanUrl(imgMatch[0]);
    if (!normUrl) return figureMatch;

    if (seenUrls.has(normUrl)) {
      // Repeated image URL: remove the duplicate figure
      return "";
    }
    seenUrls.add(normUrl);
    return figureMatch;
  });

  // 2. Process standalone <img> tags not inside figures
  cleaned = cleaned.replace(/<img[^>]+>/gi, (imgTag) => {
    const normUrl = extractCleanUrl(imgTag);
    if (!normUrl) return imgTag;

    if (seenUrls.has(normUrl)) {
      // Repeated image URL: remove the duplicate img tag
      return "";
    }
    seenUrls.add(normUrl);
    return imgTag;
  });

  // 3. Clean any orphaned empty figures or consecutive line breaks
  cleaned = cleaned
    .replace(/<figure[^>]*>\s*<\/figure>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />");

  return cleaned;
}

/**
 * Processes post HTML content:
 * - Deduplicates repeated images with the same URL (keeps only 1 occurrence, keeps all distinct images)
 * - Removes "da redação" text/paragraphs
 * - Guarantees referrerpolicy="no-referrer" and loading="lazy" on all <img> tags
 * - Keeps all unique non-repeated images intact!
 */
export function processPostContent(
  rawHtml?: string,
  featuredImageUrl?: string,
  newsItem?: Partial<NewsItem>
): string {
  if (!rawHtml) return "";

  // 1. Deduplicate repeated images by URL
  let html = deduplicateContentImages(rawHtml);

  // 2. Remove "da redação" text, headers, and paragraphs
  html = html
    .replace(/<p[^>]*>\s*(da\s+redação|da\s+redacao|redação|redacao)\s*<\/p>/gi, "")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/i, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .replace(/\bRedação Norma Jurídica\b/gi, "Norma Jurídica");

  // 3. Ensure all remaining distinct <img> tags have referrerpolicy="no-referrer" and loading="lazy"
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

  // 4. Clean empty figures or excessive breaks
  html = html
    .replace(/<figure[^>]*>\s*<\/figure>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />")
    .trim();

  return html;
}
