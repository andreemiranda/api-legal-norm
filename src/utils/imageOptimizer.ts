// Utility to format and optimize images through the /next_imagem proxy endpoint
// Ensures every news item has a high-res image and avoids duplicate renders

import { NewsItem } from "../types";

/**
 * Transforms an image URL to the optimized /next_imagem pattern
 * Supports relative, internal, and external images
 */
export function toOptimizedImage(url?: string | null): string {
  if (!url || typeof url !== "string") {
    return "/logo.jpg";
  }

  const trimmed = url.trim();
  if (!trimmed) return "/logo.jpg";

  // If already relative root or proxy
  if (trimmed.startsWith("/next_imagem?url=") || trimmed.startsWith("/next_image?url=")) {
    return trimmed;
  }
  if (trimmed === "/logo.jpg" || trimmed.startsWith("/icons/") || trimmed.startsWith("/favicon")) {
    return trimmed;
  }

  return `/next_imagem?url=${encodeURIComponent(trimmed)}`;
}

export const getProxyImageUrl = toOptimizedImage;

/**
 * Normalizes URL for duplicate comparison (removes query strings, sizing params, trailing slashes)
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
 * Extracts a featured image and any other images from the post
 */
export function extractPostImages(item: Partial<NewsItem>): {
  featuredImage: string;
  otherImages: string[];
} {
  const images: string[] = [];

  // 1. Direct fields
  if (item.thumbnail && item.thumbnail.startsWith("http")) images.push(item.thumbnail);
  if (item.imageUrl && item.imageUrl.startsWith("http") && !images.includes(item.imageUrl)) images.push(item.imageUrl);
  if (item.image && item.image.startsWith("http") && !images.includes(item.image)) images.push(item.image);

  // 2. Extract from content HTML
  if (item.content) {
    const matches = item.content.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi);
    for (const match of matches) {
      if (match[1] && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }
  }

  // 3. Extract from description HTML
  if (item.description) {
    const matches = item.description.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi);
    for (const match of matches) {
      if (match[1] && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }
  }

  const featuredImage = images[0] || "/logo.jpg";
  const otherImages = images.slice(1);

  return { featuredImage, otherImages };
}

/**
 * Extracts a featured image or fallback image from any available field in the news item
 */
export function getPostThumbnail(item: Partial<NewsItem>): string {
  const { featuredImage } = extractPostImages(item);
  return featuredImage;
}

/**
 * Processes post HTML content:
 * - Removes "da redação" text/paragraphs
 * - Ensures all images are routed through /next_imagem
 * - Removes duplicate images that match the featured image or already appeared in the body
 * - Keeps all unique secondary images intact
 */
export function processPostContent(
  rawHtml?: string,
  featuredImageUrl?: string
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
      const norm = normalizeImageUrl(src);
      if (seenImages.has(norm)) {
        return ""; // Strip duplicate figure
      }
      seenImages.add(norm);
      const optSrc = toOptimizedImage(src);
      return figureMatch.replace(src, optSrc);
    }
    return figureMatch;
  });

  // Rewrite standard <img> tags
  html = html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
    const norm = normalizeImageUrl(src);
    if (seenImages.has(norm)) {
      return ""; // Strip duplicate image
    }
    seenImages.add(norm);
    const optSrc = toOptimizedImage(src);
    return `<img${before}src="${optSrc}"${after}>`;
  });

  // Clean empty figures or excessive breaks
  html = html
    .replace(/<figure[^>]*>\s*<\/figure>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />")
    .trim();

  return html;
}
