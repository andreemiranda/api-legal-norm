import React, { useState, useMemo } from "react";

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  fallbackSrc?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Transforms any raw image URL into the optimized Next.js-compatible proxy pattern:
 * /_next/image?url=[url_image]
 */
export function getOptimizedImageUrl(rawUrl?: string | null, baseUrl: string = ""): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  // Unwrap existing proxy parameters if already encoded
  let cleanUrl = trimmed;
  try {
    if (
      cleanUrl.includes("/_next/image?url=") ||
      cleanUrl.includes("/next_imagem?url=") ||
      cleanUrl.includes("/next_image?url=")
    ) {
      const parsed = new URL(cleanUrl, "http://localhost");
      cleanUrl = parsed.searchParams.get("url") || cleanUrl;
    }
  } catch {}

  // Handle scheme-relative URLs
  if (cleanUrl.startsWith("//")) {
    cleanUrl = "https:" + cleanUrl;
  }

  // If local relative asset
  if (cleanUrl.startsWith("/") && !cleanUrl.startsWith("/_next/image")) {
    const prefix = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
    return `${prefix}/_next/image?url=${encodeURIComponent(cleanUrl)}`;
  }

  const prefix = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  return `${prefix}/_next/image?url=${encodeURIComponent(cleanUrl)}`;
}

export const toNextOptimizedImageUrl = getOptimizedImageUrl;

/**
 * Extracts all valid image candidates connected to a news item:
 * includes thumbnail, imageUrl, postImages, and images embedded in HTML content.
 */
export function extractNewsConnectedImages(item: any): Array<{ url: string; title: string }> {
  if (!item) return [];
  const results: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();

  const title = (item.title || "Notícia Norma Jurídica").trim();

  const add = (candidateUrl?: string | null) => {
    if (!candidateUrl || typeof candidateUrl !== "string") return;
    const trimmed = candidateUrl.trim();
    if (!trimmed || seen.has(trimmed)) return;

    // Filter out obvious non-editorial assets
    const lower = trimmed.toLowerCase();
    if (
      lower.includes("logo.jpg") ||
      lower.includes("favicon") ||
      lower.includes("pixel.gif") ||
      lower.endsWith(".svg") ||
      lower.includes(".svg?") ||
      lower.endsWith(".pdf")
    ) {
      return;
    }

    seen.add(trimmed);
    results.push({ url: trimmed, title });
  };

  // 1. Primary thumbnail or imageUrl
  if (item.thumbnail) add(item.thumbnail);
  if (item.imageUrl) add(item.imageUrl);

  // 2. postImages array
  if (Array.isArray(item.postImages)) {
    for (const pi of item.postImages) {
      if (typeof pi === "string") add(pi);
      else if (pi && typeof pi === "object") add(pi.url || pi.imageUrl);
    }
  }

  // 3. Embedded <img> tags inside content
  if (typeof item.content === "string") {
    const matches = item.content.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>]*)?/gi) || [];
    for (const m of matches) {
      add(m);
    }
  }

  return results;
}

/**
 * Escapes special XML characters for sitemap validity.
 */
function escapeXml(text?: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds Google Image XML entry for a given news item with all connected images
 * formatted with the optimized pattern: (/_next/image?url=[url_image])
 */
export function buildImageSitemapEntry(item: any, siteUrl: string = ""): string {
  if (!item || !item.slug) return "";

  const images = extractNewsConnectedImages(item);
  if (images.length === 0) return "";

  const prefix = siteUrl ? siteUrl.replace(/\/+$/, "") : "";
  const pageLoc = `${prefix}/${item.slug.replace(/^\/+/, "")}`;
  let dateStr = new Date().toISOString().split("T")[0];
  if (item.pubDate) {
    try {
      const parsed = new Date(item.pubDate);
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toISOString().split("T")[0];
      } else {
        const match = String(item.pubDate).match(/\d{4}-\d{2}-\d{2}/);
        if (match) dateStr = match[0];
      }
    } catch {}
  }

  let imageTags = "";
  for (const img of images) {
    const optimizedLoc = getOptimizedImageUrl(img.url, siteUrl);
    const cleanTitle = escapeXml(img.title || item.title || "");
    imageTags += `    <image:image>
      <image:loc>${optimizedLoc}</image:loc>
      <image:title>${cleanTitle}</image:title>
    </image:image>\n`;
  }

  return `  <url>
    <loc>${pageLoc}</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
${imageTags}  </url>\n`;
}

/**
 * Generates complete Google Image Sitemap XML for all connected news images.
 */
export function generateFullImageSitemapXml(newsItems: any[], siteUrl: string = ""): string {
  let entries = "";
  for (const item of newsItems) {
    entries += buildImageSitemapEntry(item, siteUrl);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries}</urlset>
`;
}

/**
 * Optimized Image React component.
 * Loads the image via the Next.js optimized proxy pattern: /_next/image?url=[url_image],
 * with graceful direct-URL fallback and referrerpolicy.
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt = "Imagem da notícia",
  fallbackSrc,
  priority = false,
  className = "",
  onError,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [triedDirect, setTriedDirect] = useState(false);

  // Compute optimized proxy URL: /_next/image?url=[url_image]
  const optimizedSrc = useMemo(() => {
    if (!src) return "";
    return getOptimizedImageUrl(src);
  }, [src]);

  const activeSrc = useMemo(() => {
    if (hasError && fallbackSrc) return fallbackSrc;
    if (triedDirect) return src; // Fallback to raw direct URL if proxy failed
    return optimizedSrc || src;
  }, [hasError, fallbackSrc, triedDirect, optimizedSrc, src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!triedDirect && src && src !== optimizedSrc) {
      setTriedDirect(true); // Try original direct URL before erroring out
      return;
    }
    setHasError(true);
    if (onError) onError(e);
  };

  if (!activeSrc) {
    return (
      <div className={`flex items-center justify-center bg-slate-900 text-slate-500 text-xs ${className}`}>
        <span>{alt || "Notícia"}</span>
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={handleError}
      className={className}
      {...props}
    />
  );
};

export default OptimizedImage;
