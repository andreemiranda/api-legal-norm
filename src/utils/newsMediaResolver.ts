import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NewsItem } from "../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  isValidApiImageUrl,
  normalizeImageUrl,
  getImageFingerprint,
  areImagesEquivalent,
} from "./imageOptimizer";
import { verifyImageSource } from "./imageVerification";

export interface MediaCatalogItem {
  id?: number | string;
  postId?: number | string | null;
  slug?: string;
  alt?: string;
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
    slug?: string;
    alt?: string;
    alt_text?: string;
    post?: number | string;
    parent?: number | string;
    title?: any;
    media_details?: any;
    [key: string]: any;
  };
}

interface IndexedMediaItem extends MediaCatalogItem {
  cleanSlug: string;
  cleanAlt: string;
  cleanTitle: string;
  slugTokens: Set<string>;
  altTokens: Set<string>;
  titleTokens: Set<string>;
  normalizedImageUrl: string;
  imageFingerprint: string;
}

let inMemoryCatalog: MediaCatalogItem[] = [];
let allIndexedCatalog: IndexedMediaItem[] = [];
let mediaBySource = new Map<string, IndexedMediaItem[]>();
let mediaByPostId = new Map<string, IndexedMediaItem[]>();
let mediaBySlug = new Map<string, IndexedMediaItem[]>();

const STOPWORDS = new Set([
  "para", "com", "por", "sobre", "apos", "desta", "deste", "como", "mais",
  "pelo", "pela", "onde", "quando", "noticia", "noticias", "post", "attachment",
  "uploads", "https", "http", "html", "ghtml", "brasil", "video", "videos",
  "novo", "nova", "diz", "veja", "saiba", "entre", "ainda", "seus", "suas"
]);

/**
 * Tokenizes text into lowercase, accent-stripped words with stopwords filtered.
 */
function tokenize(str?: string | null): Set<string> {
  if (!str || typeof str !== "string") return new Set();
  const normalized = str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");

  const words = normalized.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Computes common token overlap count between two word sets.
 */
function tokenOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let matches = 0;
  for (const item of setA) {
    if (setB.has(item)) matches++;
  }
  return matches;
}

export function deduplicateImageList(urls: (string | undefined | null)[]): string[] {
  const result: string[] = [];
  const seenNorm = new Set<string>();
  const seenFp = new Set<string>();

  for (const raw of urls) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || !isValidApiImageUrl(trimmed)) continue;

    const norm = normalizeImageUrl(trimmed);
    const fp = getImageFingerprint(trimmed);

    if (norm && !seenNorm.has(norm) && (!fp || !seenFp.has(fp))) {
      seenNorm.add(norm);
      if (fp) seenFp.add(fp);
      result.push(trimmed);
    }
  }

  return result;
}

export function extractSlug(urlOrStr?: string | null): string {
  if (!urlOrStr || typeof urlOrStr !== "string") return "";
  const clean = urlOrStr.split("?")[0].replace(/\/+$/, "");
  const parts = clean.split("/").filter(Boolean);
  return parts.pop() || "";
}

function reindexCatalog() {
  allIndexedCatalog = [];
  mediaBySource.clear();
  mediaByPostId.clear();
  mediaBySlug.clear();

  for (const m of inMemoryCatalog) {
    if (!m.imageUrl || !isValidApiImageUrl(m.imageUrl)) continue;

    const rawSlug = (m.slug || m.raw?.slug || "").trim();
    const rawAlt = (m.alt || m.raw?.alt_text || m.raw?.alt || "").trim();
    const rawTitle = (typeof m.title === "string" ? m.title : (m.raw?.title?.rendered || m.raw?.title || "")).trim();

    // Extract slug from link and imageUrl
    let linkSlug = "";
    if (m.link) {
      const parts = m.link.split("?")[0].replace(/\/+$/, "").split("/").filter(Boolean);
      if (parts.length >= 2) {
        linkSlug = parts[parts.length - 2].toLowerCase(); // In WP: /parent-slug/attachment/media-slug
        if (linkSlug === "attachment" && parts.length >= 3) {
          linkSlug = parts[parts.length - 3].toLowerCase();
        }
      }
    }

    let urlSlug = "";
    if (m.imageUrl) {
      const urlParts = m.imageUrl.split("?")[0].replace(/\.[a-z0-9]+$/i, "").split("/").filter(Boolean);
      urlSlug = urlParts[urlParts.length - 1] || "";
    }

    const combinedSlugStr = `${rawSlug} ${linkSlug} ${urlSlug}`.trim();

    const indexedItem: IndexedMediaItem = {
      ...m,
      slug: rawSlug || linkSlug || urlSlug,
      alt: rawAlt,
      title: rawTitle,
      cleanSlug: combinedSlugStr.toLowerCase(),
      cleanAlt: rawAlt.toLowerCase(),
      cleanTitle: rawTitle.toLowerCase(),
      slugTokens: tokenize(combinedSlugStr),
      altTokens: tokenize(rawAlt),
      titleTokens: tokenize(rawTitle),
      normalizedImageUrl: normalizeImageUrl(m.imageUrl),
      imageFingerprint: getImageFingerprint(m.imageUrl),
    };

    allIndexedCatalog.push(indexedItem);

    // Index by Source ID
    const srcKey = String(m.sourceId || m.site || "").trim();
    if (srcKey) {
      if (!mediaBySource.has(srcKey)) mediaBySource.set(srcKey, []);
      mediaBySource.get(srcKey)!.push(indexedItem);
    }

    // Index by parent Post ID
    const pid = m.postId || m.raw?.post || m.raw?.parent;
    if (pid) {
      const pKey = String(pid);
      if (!mediaByPostId.has(pKey)) mediaByPostId.set(pKey, []);
      mediaByPostId.get(pKey)!.push(indexedItem);
    }

    // Index by slug
    if (rawSlug) {
      const sKey = rawSlug.toLowerCase();
      if (!mediaBySlug.has(sKey)) mediaBySlug.set(sKey, []);
      mediaBySlug.get(sKey)!.push(indexedItem);
    }
    if (linkSlug && linkSlug !== rawSlug) {
      const lKey = linkSlug.toLowerCase();
      if (!mediaBySlug.has(lKey)) mediaBySlug.set(lKey, []);
      mediaBySlug.get(lKey)!.push(indexedItem);
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
    path.join("/tmp", "mediaCatalog.json"),
    path.join(process.cwd(), "src", "data", "mediaCatalog.json"),
    path.join(process.cwd(), "dist", "data", "mediaCatalog.json"),
    path.join(process.cwd(), "data", "mediaCatalog.json"),
    path.join(__dirname, "src", "data", "mediaCatalog.json"),
    path.join(__dirname, "..", "src", "data", "mediaCatalog.json"),
    path.join(__dirname, "dist", "data", "mediaCatalog.json"),
    path.join(__dirname, "..", "dist", "data", "mediaCatalog.json"),
    path.join(__dirname, "data", "mediaCatalog.json"),
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
 * Finds the correct authentic WordPress image for a news item using:
 * 1. Parent post ID (highest confidence)
 * 2. Media 'slug' tag matching news item slug / link
 * 3. Media 'alt' tag matching news title and key subjects
 * STRICT RULE: Only matches media within the same source and requires verified correlation
 * to avoid images from one article mistakenly appearing in another!
 */
export function findWordPressMediaMatch(item: Partial<NewsItem>): { imageUrl: string; altText: string } | null {
  if (inMemoryCatalog.length === 0) return null;

  // 1. Direct Post ID match (WordPress parent post)
  if (item.id) {
    const postMatches = mediaByPostId.get(String(item.id));
    if (postMatches && postMatches.length > 0) {
      const match = postMatches.find((x) => x.imageUrl && isValidApiImageUrl(x.imageUrl));
      if (match?.imageUrl) {
        return {
          imageUrl: match.imageUrl,
          altText: match.alt || match.title || String(item.title || ""),
        };
      }
    }
  }

  const srcKey = String(item.sourceId || item.sourceSite || "").trim();
  const pool = mediaBySource.get(srcKey);

  // Strictly search only within the source pool to prevent cross-source contamination
  if (!pool || pool.length === 0) {
    return null;
  }

  const rawPostSlug = extractSlug(item.link || item.slug || "").toLowerCase();
  const postSlugTokens = tokenize(rawPostSlug);
  const titleTokens = tokenize(item.title);

  let bestMatch: IndexedMediaItem | null = null;
  let bestScore = 0;

  for (const m of pool) {
    // Check direct slug match
    if (rawPostSlug && m.cleanSlug && m.cleanSlug.includes(rawPostSlug)) {
      return {
        imageUrl: m.imageUrl!,
        altText: m.alt || m.title || String(item.title || ""),
      };
    }

    const slugMatches = tokenOverlap(postSlugTokens, m.slugTokens);
    const altMatches = tokenOverlap(titleTokens, m.altTokens);
    const titleMatches = tokenOverlap(titleTokens, m.titleTokens);

    // Weighted matching score prioritizing slug and alt tags as requested
    const score = (slugMatches * 4) + (altMatches * 4) + (titleMatches * 2);

    // Minimum verification threshold:
    // Requires at least 2 slug tokens, or 2 alt tokens, or 1 slug + 1 alt token matching!
    if (
      score > bestScore &&
      (slugMatches >= 2 || altMatches >= 2 || (slugMatches >= 1 && altMatches >= 1))
    ) {
      bestScore = score;
      bestMatch = m;
    }
  }

  if (bestMatch?.imageUrl) {
    return {
      imageUrl: bestMatch.imageUrl,
      altText: bestMatch.alt || bestMatch.title || String(item.title || ""),
    };
  }

  return null;
}

/**
 * Resolves authentic images for a news item, guaranteeing at least one image,
 * correctly associating WordPress images via slug and alt tags,
 * and strictly preventing images from one news appearing in another.
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

  // 1. Check WordPress Image Endpoint via slug and alt tags
  const wpMatch = findWordPressMediaMatch(item);
  if (wpMatch?.imageUrl) {
    rawCandidates.push(wpMatch.imageUrl);
  }

  // 2. Direct item fields from the article itself
  if (item.thumbnail) rawCandidates.push(item.thumbnail);
  if (item.imageUrl) rawCandidates.push(item.imageUrl);
  if (item.image) rawCandidates.push(item.image);
  if (Array.isArray(item.images)) rawCandidates.push(...item.images);
  if ((item as any)?.mediaUrl) rawCandidates.push((item as any).mediaUrl);
  if ((item as any)?.photo) rawCandidates.push((item as any).photo);
  if ((item as any)?.cover) rawCandidates.push((item as any).cover);

  // 3. Enclosure
  const enc = (item as any)?.enclosure;
  if (enc) {
    if (typeof enc === "string") rawCandidates.push(enc);
    else if (typeof enc === "object" && enc.url) rawCandidates.push(enc.url);
  }

  // 4. Embedded images in content and description
  if (item.content) {
    rawCandidates.push(...extractImagesFromHtml(item.content));
  }
  if (item.description) {
    rawCandidates.push(...extractImagesFromHtml(item.description));
  }

  // Filter and deduplicate candidates, rejecting any cross-source swapped images
  const deduped = deduplicateImageList(rawCandidates);
  const distinctImages = deduped.filter((img) => {
    const check = verifyImageSource(img, item);
    return check.valid;
  });

  // 5. If STILL empty (no image in content and no match in catalog):
  // Never assign an editorial photo of another news/person!
  // Fallback cleanly to authentic authorized visual
  if (distinctImages.length === 0) {
    const linkHost = (item.link || item.sourceSite || "").toLowerCase();
    if (linkHost.includes("globo.com") || linkHost.includes("glbimg.com")) {
      distinctImages.push("https://s2-g1.glbimg.com/FAbgtDgxjSP1NlU5MhFFAbirOeQ=/i.s3.glbimg.com/v1/AUTH_5902ecb793a540d99060c1569f5f0582/internal_photos/bs/2026/G/1/g1-padrao.jpg");
    } else {
      const cat = (item.category || "").toLowerCase();
      if (cat.includes("educa")) {
        distinctImages.push("https://infoeducacao.com.br/wp-content/uploads/2026/09/118181-3-1.jpg");
      } else if (cat.includes("finan") || cat.includes("econ")) {
        distinctImages.push("https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/2026/09/bolsa-valores-b3.jpg");
      } else {
        distinctImages.push("https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/2026/09/supremo-tribunal-federal-stf.jpg");
      }
    }
  }

  const primaryImage = distinctImages[0] || "";
  const verifiedAlt = wpMatch?.altText || officialTitle;

  return {
    primaryImage,
    images: distinctImages,
    verifiedAlt,
  };
}

export function getMediaCatalogCount(): number {
  return inMemoryCatalog.length;
}
