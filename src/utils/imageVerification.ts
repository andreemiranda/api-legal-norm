// Triple-Verification Engine: Verificação via Fonte, via Slug e via Texto Alt
// Impede que imagens trocadas, imagens de outros portais ou arquivos desconexos sejam atribuídos a notícias.

import { NewsItem } from "../types";

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  verifiedAlt?: string;
}

/**
 * Extracts a normalized hostname from a URL.
 */
export function extractHostname(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  try {
    let clean = url.trim();
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "https://" + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Common technical/asset filenames or query artifacts that are NOT legitimate news photos.
 */
const TECHNICAL_ASSETS = [
  "submit-spin",
  "spin.svg",
  "wpforms",
  "spinner",
  "loading",
  "avatar",
  "default-avatar",
  "favicon",
  "pixel.gif",
  "1x1",
  "blank.gif",
  "banner-ad",
  "/ads/",
  "/ad/",
  "logo.jpg",
  "logo.png",
  "logo.svg",
  "og-image",
  "apple-touch-icon",
];

/**
 * Known distinct media publishers or sports/entertainment outlets.
 * Images from these domains MUST NOT be cross-assigned to articles from other domains!
 */
const DISTINCT_PUBLISHER_DOMAINS = [
  "palmeiras.com.br",
  "admin.cnnbrasil.com.br",
  "cnnbrasil.com.br",
  "classic.exame.com",
  "exame.com",
  "vocesa.abril.com.br",
  "abril.com.br",
  "atitudeto.com.br",
  "pmwnoticias.com.br",
  "jornalobico.com.br",
  "uploads.gazetadocerrado.com.br",
  "gazetadocerrado.com.br",
  "inw.org.br",
  "folhadestra.com",
  "folhadobico.com.br",
  "portaldobico.com.br",
  "meusitejuridico.editorajuspodivm.com.br",
  "minhaseconomias.com.br",
  "portalnoticiasgoias.com.br",
  "diariodegoias.com.br",
  "infoeducacao.com.br",
  "ludopedio.org.br",
];

/**
 * CDNs officially authorized for specific news domains
 */
const AUTHORIZED_CDN_MAP: Record<string, string[]> = {
  "g1.globo.com": ["s2-g1.glbimg.com", "s2-ge.glbimg.com", "s2-techtudo.glbimg.com", "glbimg.com", "globo.com"],
  "globo.com": ["s2-g1.glbimg.com", "s2-ge.glbimg.com", "s2-techtudo.glbimg.com", "glbimg.com", "globo.com"],
  "gazetadocerrado.com.br": ["uploads.gazetadocerrado.com.br", "gazetadocerrado.com.br"],
  "cnnbrasil.com.br": ["admin.cnnbrasil.com.br", "cnnbrasil.com.br"],
  "exame.com": ["classic.exame.com", "exame.com"],
};

/**
 * Strong entity names that, if present in the image slug or alt text,
 * require that the news article also explicitly mentions them.
 */
const CONTRADICTION_KEYWORDS = [
  "palmeiras",
  "abel-ferreira",
  "abel ferreira",
  "toy-story",
  "toy story",
  "virginia-fonseca",
  "virginia fonseca",
  "jessie",
  "predio-desaba",
  "predio desaba",
  "desaparecidos-jandira",
  "desaparecidos jandira",
  "luxemburgo",
  "artpalco",
  "copa-do-brasil",
  "copa do brasil",
  "campeonato-brasileiro",
  "campeonato brasileiro",
  "flamengo",
  "corinthians",
  "sao-paulo-fc",
];

/**
 * 1. VERIFICAÇÃO VIA FONTE (Source / Domain Verification)
 * Garante que a imagem se origine legitimamente da mesma fonte da notícia ou de CDN autorizado.
 */
export function verifyImageSource(
  imageUrl: string,
  newsItem: Partial<NewsItem>
): { valid: boolean; reason?: string } {
  const imgHost = extractHostname(imageUrl);
  if (!imgHost) {
    return { valid: false, reason: "invalid_image_url" };
  }

  // Permitted universal static CDNs (Unsplash and stock APIs strictly excluded)
  if (
    imgHost.includes("wikimedia.org") ||
    imgHost.includes("licdn.com") ||
    imgHost.includes("cloud.google.com")
  ) {
    return { valid: true };
  }

  const linkHost = extractHostname(newsItem.link || newsItem.sourceSite || "");

  // If we know the link host
  if (linkHost) {
    // Exact domain match
    if (imgHost === linkHost) return { valid: true };

    // Subdomain match (e.g., uploads.gazetadocerrado.com.br <-> gazetadocerrado.com.br)
    if (imgHost.endsWith("." + linkHost) || linkHost.endsWith("." + imgHost)) {
      return { valid: true };
    }

    // Authorized CDN check (e.g., s2-g1.glbimg.com for g1.globo.com)
    for (const [sourceDomain, cdns] of Object.entries(AUTHORIZED_CDN_MAP)) {
      if (linkHost.includes(sourceDomain) || sourceDomain.includes(linkHost)) {
        if (cdns.some((cdn) => imgHost.includes(cdn))) {
          return { valid: true };
        }
      }
    }

    // Direct cross-publisher conflict check
    const isDistinctImgHost = DISTINCT_PUBLISHER_DOMAINS.some((d) => imgHost.includes(d));
    const isDistinctLinkHost = DISTINCT_PUBLISHER_DOMAINS.some((d) => linkHost.includes(d));

    if (isDistinctImgHost && isDistinctLinkHost) {
      return {
        valid: false,
        reason: `cross_publisher_source_swap: link=${linkHost} != img=${imgHost}`,
      };
    }

    // Specific severe cases from polluted datasets
    if (imgHost.includes("palmeiras.com.br") && !linkHost.includes("palmeiras")) {
      return { valid: false, reason: "palmeiras_source_mismatch" };
    }
    if (imgHost.includes("cnnbrasil.com.br") && !linkHost.includes("cnnbrasil")) {
      return { valid: false, reason: "cnn_source_mismatch" };
    }
    if (imgHost.includes("exame.com") && !linkHost.includes("exame")) {
      return { valid: false, reason: "exame_source_mismatch" };
    }
  }

  return { valid: true };
}

/**
 * 2. VERIFICAÇÃO VIA SLUG (URL Path & Keyword Semantic Verification)
 * Impede que imagens com slugs de outros temas (ex: futebol, celebridades, acidentes de outros estados)
 * sejam anexadas a notícias de direito/legislação ou temas distintos.
 */
export function verifyImageSlug(
  imageUrl: string,
  newsItem: Partial<NewsItem>
): { valid: boolean; reason?: string } {
  if (!imageUrl || typeof imageUrl !== "string") {
    return { valid: false, reason: "empty_url" };
  }

  const cleanUrl = imageUrl.toLowerCase().split("?")[0];

  // Technical noise check
  for (const asset of TECHNICAL_ASSETS) {
    if (cleanUrl.includes(asset)) {
      return { valid: false, reason: `technical_asset: ${asset}` };
    }
  }

  // Extract path and filename slug
  const segments = cleanUrl.split("/").filter(Boolean);
  const filename = segments.pop() || "";
  const slugPath = segments.join(" ");

  const combinedSlugText = (filename + " " + slugPath)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]/g, " ");

  const titleNorm = (newsItem.title || "").toLowerCase();
  const descNorm = (newsItem.description || "").toLowerCase();
  const contentNorm = (newsItem.content || "").slice(0, 300).toLowerCase();
  const articleSlugNorm = (newsItem.slug || "").replace(/[-_]/g, " ").toLowerCase();

  const articleFullContext = `${titleNorm} ${descNorm} ${contentNorm} ${articleSlugNorm}`;

  // Check against known contradictory keywords
  for (const term of CONTRADICTION_KEYWORDS) {
    const termClean = term.replace(/[-_]/g, " ");
    if (combinedSlugText.includes(termClean)) {
      if (!articleFullContext.includes(termClean)) {
        return {
          valid: false,
          reason: `slug_contradiction: image contains '${term}' not in article title/context`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * 3. VERIFICAÇÃO VIA TEXTO ALT (Alt Text Verification)
 * Garante que o texto descritivo/alt da imagem não descreva um assunto conflitante
 * e prepara o texto alt oficial sincronizado com o título da notícia.
 */
export function verifyImageAlt(
  imageAlt: string | undefined | null,
  newsItem: Partial<NewsItem>
): { valid: boolean; reason?: string; verifiedAlt: string } {
  const officialTitle = (newsItem.title || "Notícia - Norma Jurídica")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .trim();

  if (!imageAlt || typeof imageAlt !== "string" || !imageAlt.trim()) {
    // If no alt text was attached, we provide the verified article title as official alt
    return { valid: true, verifiedAlt: officialTitle };
  }

  const altNorm = imageAlt.toLowerCase().trim();
  const titleNorm = officialTitle.toLowerCase();
  const descNorm = (newsItem.description || "").toLowerCase();
  const articleFullContext = `${titleNorm} ${descNorm}`;

  // Check if existing alt explicitly describes a contradictory subject
  for (const term of CONTRADICTION_KEYWORDS) {
    const termClean = term.replace(/[-_]/g, " ");
    if (altNorm.includes(termClean)) {
      if (!articleFullContext.includes(termClean)) {
        return {
          valid: false,
          reason: `alt_contradiction: alt describes '${term}' not in article`,
          verifiedAlt: officialTitle,
        };
      }
    }
  }

  // Valid alt text
  return { valid: true, verifiedAlt: imageAlt.trim() || officialTitle };
}

/**
 * MASTER VERIFICATION FUNCTION
 * Valida a URL da imagem garantindo protocolo válido e excluindo ruídos técnicos ou SVGs.
 */
export function verifyNewsImage(
  imageUrl: string | undefined | null,
  newsItem: Partial<NewsItem>,
  imageAlt?: string | null
): VerificationResult {
  if (!imageUrl || typeof imageUrl !== "string") {
    return { valid: false, reason: "empty_url" };
  }

  const trimmed = imageUrl.trim();
  if (
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("data:image/")
  ) {
    return { valid: false, reason: "invalid_protocol" };
  }

  const lower = trimmed.toLowerCase();
  // STRICT RULE: Reject Unsplash and any third-party stock photo API fallback
  if (lower.includes("unsplash.com") || lower.includes("stockphoto") || lower.includes("shutterstock") || lower.includes("gettyimages")) {
    return { valid: false, reason: "external_api_banned" };
  }

  // Strictly reject SVGs
  if (lower.startsWith("data:image/svg") || lower.endsWith(".svg") || lower.includes(".svg?")) {
    return { valid: false, reason: "svg_rejected" };
  }

  // Reject technical tracking pixels or UI spinners
  for (const asset of TECHNICAL_ASSETS) {
    if (lower.includes(asset)) {
      return { valid: false, reason: `technical_asset: ${asset}` };
    }
  }

  return {
    valid: true,
    verifiedAlt: (imageAlt && imageAlt.trim()) || newsItem.title || "Norma Jurídica",
  };
}

/**
 * Searches the news item's content, description, and direct fields
 * across the most diverse image formats (.jpg, .jpeg, .png, .webp, .avif, .gif, .bmp, .tiff, .jfif, .heic).
 * Returns authentic images from the article's own content (1st, 2nd, etc.).
 * NEVER uses Unsplash or external API fallbacks.
 */
export function resolveAuthenticNewsImage(newsItem: Partial<NewsItem>): {
  verifiedImage: string | null;
  verifiedAlt: string;
  isFallback: boolean;
  candidates?: string[];
} {
  const officialTitle = (newsItem.title || "Notícia")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .trim();

  const foundUrls: string[] = [];
  const seenNorm = new Set<string>();

  const addCandidate = (rawUrl?: string | null) => {
    if (!rawUrl || typeof rawUrl !== "string") return;
    let url = rawUrl.trim();
    if (url.startsWith("&quot;") || url.endsWith("&quot;")) url = url.replace(/^&quot;|&quot;$/g, "");
    if (url.startsWith("&#39;") || url.endsWith("&#39;")) url = url.replace(/^&#39;|&#39;$/g, "");
    if (url.startsWith("//")) url = "https:" + url;
    url = url.replace(/&amp;/g, "&");

    const vRes = verifyNewsImage(url, newsItem);
    if (!vRes.valid) return;

    const norm = url.split("?")[0].replace(/^https?:\/\//, "").toLowerCase();
    if (!seenNorm.has(norm)) {
      seenNorm.add(norm);
      foundUrls.push(url);
    }
  };

  // 1. Direct news fields (authoritative sources)
  addCandidate(newsItem.thumbnail);
  addCandidate(newsItem.imageUrl);
  addCandidate(newsItem.image);
  if (Array.isArray(newsItem.images)) {
    for (const img of newsItem.images) {
      addCandidate(img);
    }
  }
  addCandidate((newsItem as any)?.mediaUrl);
  addCandidate((newsItem as any)?.photo);
  addCandidate((newsItem as any)?.cover);

  const enc = (newsItem as any)?.enclosure;
  if (enc) {
    if (typeof enc === "string") addCandidate(enc);
    else if (typeof enc === "object" && enc.url) addCandidate(enc.url);
  }
  const mediaContent = (newsItem as any)?.["media:content"];
  if (mediaContent) {
    if (typeof mediaContent === "string") addCandidate(mediaContent);
    else if (typeof mediaContent === "object" && mediaContent.url) addCandidate(mediaContent.url);
  }
  const mediaThumb = (newsItem as any)?.["media:thumbnail"];
  if (mediaThumb) {
    if (typeof mediaThumb === "string") addCandidate(mediaThumb);
    else if (typeof mediaThumb === "object" && mediaThumb.url) addCandidate(mediaThumb.url);
  }

  // 2. Scan all content and description text across diverse image formats
  const textPool = [
    newsItem.content,
    newsItem.description,
    (newsItem as any)?.["content:encoded"],
    (newsItem as any)?.body,
    (newsItem as any)?.summary,
  ].filter(Boolean).join(" ");

  if (textPool) {
    // 2a. Any <img> with src, data-src, data-original, data-lazy-src, data-hi-res-src, data-actualsrc, etc.
    const attrRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy-src|data-hi-res-src|data-actualsrc|data-default-src|data-url|data-fallback)=["']([^"']+)["']/gi;
    let m;
    while ((m = attrRegex.exec(textPool)) !== null) {
      addCandidate(m[1]);
    }

    // 2b. Unquoted <img src=...>
    const unquotedRegex = /<img[^>]+src=([^\s"'>]+)/gi;
    while ((m = unquotedRegex.exec(textPool)) !== null) {
      addCandidate(m[1]);
    }

    // 2c. srcset or data-srcset
    const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
    while ((m = srcsetRegex.exec(textPool)) !== null) {
      const parts = m[1].split(",");
      for (const p of parts) {
        const u = p.trim().split(/\s+/)[0];
        if (u) addCandidate(u);
      }
    }

    // 2d. HTML-escaped image tags (&lt;img ... src=&quot;...&quot;)
    const escapedRegex = /&lt;img[^&]+(?:src|data-src)=&quot;([^&]+)&quot;/gi;
    while ((m = escapedRegex.exec(textPool)) !== null) {
      addCandidate(m[1]);
    }

    // 2e. Markdown images ![alt](url)
    const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
    while ((m = mdRegex.exec(textPool)) !== null) {
      addCandidate(m[1]);
    }

    // 2f. CSS background-image
    const cssRegex = /url\(["']?(https?:\/\/[^\)"']+)["']?\)/gi;
    while ((m = cssRegex.exec(textPool)) !== null) {
      addCandidate(m[1]);
    }

    // 2g. Regex covering diverse image formats (.jpg, .jpeg, .png, .webp, .avif, .gif, .bmp, .tiff, .jfif, .heic)
    const formatsRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|avif|gif|bmp|tiff|jfif|heic)(?:\?[^\s"'<>]*)?)/gi;
    while ((m = formatsRegex.exec(textPool)) !== null) {
      addCandidate(m[1]);
    }

    // 2h. Globo / News CDN paths (e.g. s2-g1.glbimg.com)
    const cdnRegex = /(https?:\/\/s2-[a-z0-9]+\.glbimg\.com\/[^\s"'<>]+)/gi;
    while ((m = cdnRegex.exec(textPool)) !== null) {
      addCandidate(m[1]);
    }
  }

  // If any valid images found in article content, use the 1st or 2nd from that content
  if (foundUrls.length > 0) {
    return {
      verifiedImage: foundUrls[0],
      verifiedAlt: officialTitle,
      isFallback: false,
      candidates: foundUrls,
    };
  }

  // When no images exist in the article content, return null (STRICT: NO UNSPLASH, NO EXTERNAL API FALLBACK)
  return {
    verifiedImage: null,
    verifiedAlt: officialTitle,
    isFallback: false,
    candidates: [],
  };
}
