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

  // Permitted universal static CDNs
  if (
    imgHost.includes("unsplash.com") ||
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
 * Valida a imagem pelas três regras: Fonte, Slug e Texto Alt.
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
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("//")) {
    return { valid: false, reason: "invalid_protocol" };
  }

  // 1. Fonte
  const sourceCheck = verifyImageSource(trimmed, newsItem);
  if (!sourceCheck.valid) {
    return sourceCheck;
  }

  // 2. Slug
  const slugCheck = verifyImageSlug(trimmed, newsItem);
  if (!slugCheck.valid) {
    return slugCheck;
  }

  // 3. Texto Alt
  const altCheck = verifyImageAlt(imageAlt, newsItem);
  if (!altCheck.valid) {
    return altCheck;
  }

  return {
    valid: true,
    verifiedAlt: altCheck.verifiedAlt,
  };
}

/**
 * Searches the news item's content, description, and direct fields
 * to resolve the best verified authentic image.
 * Returns null if no authentic image exists, so the caller can render the clean editorial SVG fallback.
 */
export function resolveAuthenticNewsImage(newsItem: Partial<NewsItem>): {
  verifiedImage: string | null;
  verifiedAlt: string;
  isFallback: boolean;
} {
  const officialTitle = (newsItem.title || "Notícia")
    .replace(/^(\s*da\s+redação[\s:-]*|\s*da\s+redacao[\s:-]*)/gi, "")
    .replace(/\b(da\s+redação|da\s+redacao)\b/gi, "")
    .trim();

  // Candidates with their potential alt attributes
  const candidates: Array<{ url?: string | null; alt?: string | null }> = [];

  // 1. Check content <img> tags with their alt attribute
  if (newsItem.content) {
    const matches = newsItem.content.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi);
    for (const m of matches) {
      const tagStr = m[0];
      const src = m[1];
      const altMatch = tagStr.match(/alt=["']([^"']*)["']/i);
      candidates.push({ url: src, alt: altMatch ? altMatch[1] : undefined });
    }
  }

  // 2. Check description <img> tags
  if (newsItem.description) {
    const matches = newsItem.description.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi);
    for (const m of matches) {
      const tagStr = m[0];
      const src = m[1];
      const altMatch = tagStr.match(/alt=["']([^"']*)["']/i);
      candidates.push({ url: src, alt: altMatch ? altMatch[1] : undefined });
    }
  }

  // 3. Direct fields
  candidates.push({ url: newsItem.thumbnail, alt: (newsItem as any).imageAlt });
  candidates.push({ url: newsItem.imageUrl, alt: (newsItem as any).imageAlt });
  candidates.push({ url: newsItem.image, alt: (newsItem as any).imageAlt });

  // 4. Enclosure
  const enc = (newsItem as any).enclosure;
  if (enc) {
    if (typeof enc === "string") {
      candidates.push({ url: enc, alt: officialTitle });
    } else if (typeof enc === "object" && enc.url) {
      candidates.push({ url: enc.url, alt: enc.title || enc.description || officialTitle });
    }
  }

  // Test candidates against Triple-Verification
  for (const c of candidates) {
    if (c.url) {
      const res = verifyNewsImage(c.url, newsItem, c.alt);
      if (res.valid) {
        return {
          verifiedImage: c.url.trim(),
          verifiedAlt: res.verifiedAlt || officialTitle,
          isFallback: false,
        };
      }
    }
  }

  // None passed verification -> return null and let system render editorial SVG
  return {
    verifiedImage: null,
    verifiedAlt: officialTitle,
    isFallback: true,
  };
}
