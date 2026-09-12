// Slug and URL helpers conforming to SEO and clean URL architecture

export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalizes category name for clean URLs
 * e.g., "Campinas e região" -> "campinas-e-regiao"
 */
export function categoryToSlug(category: string): string {
  if (!category || category === "Todas") return "todas";
  return slugify(category);
}

/**
 * Compares two category strings loosely (handles accents, casing, hyphens, and %20)
 */
export function matchCategories(catA?: string, catB?: string): boolean {
  if (!catA || !catB) return false;
  if (catA === catB) return true;
  const a = slugify(decodeURIComponent(catA));
  const b = slugify(decodeURIComponent(catB));
  return a === b;
}

/**
 * Generates clean canonical post slug adhering to portal architecture:
 * e.g., post/sc/santa-catarina/noticia/2026/09/07/desfile-7-setembro-25-mil-estudantes-forcas-armadas-e-seguranca-florianopolis
 */
export function generatePostSlug(item: {
  id?: string | number;
  link?: string;
  title?: string;
  category?: string;
  pubDate?: string;
  slug?: string;
}): string {
  // If slug already formatted cleanly as post/...
  if (item.slug && item.slug.startsWith("post/") && !item.slug.includes("http") && !item.slug.includes(".ghtml")) {
    return item.slug;
  }

  const rawUrl = (typeof item.link === "string" && item.link.startsWith("http"))
    ? item.link
    : (typeof item.id === "string" && item.id.startsWith("http"))
      ? item.id
      : "";

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const cleanPath = parsed.pathname
        .replace(/\.(ghtml|html|htm|php|asp|aspx)$/i, "")
        .replace(/^\/+|\/+$/g, "");

      if (cleanPath && cleanPath.length > 5) {
        return `post/${cleanPath}`;
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback slug constructed from category, date, and title
  const dateObj = item.pubDate ? new Date(item.pubDate) : new Date();
  const year = isNaN(dateObj.getFullYear()) ? "2026" : String(dateObj.getFullYear());
  const month = isNaN(dateObj.getMonth()) ? "09" : String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = isNaN(dateObj.getDate()) ? "07" : String(dateObj.getDate()).padStart(2, "0");

  const catSlug = slugify(item.category || "noticias");
  const titleSlug = slugify(item.title || "noticia");

  return `post/${catSlug}/noticia/${year}/${month}/${day}/${titleSlug}`;
}

/**
 * Cleans encoded text, fixes mojibake or escaped entity errors
 */
export function sanitizePortalText(text: string): string {
  if (!text) return "";
  let out = text;
  try {
    if (out.includes("%")) {
      out = decodeURIComponent(out);
    }
  } catch {
    // Keep as is if decode fails
  }

  // Common mojibake fixes
  out = out
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã£/g, "ã")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã¢/g, "â")
    .replace(/Ãª/g, "ê")
    .replace(/Ã´/g, "ô")
    .replace(/Ã§/g, "ç")
    .replace(/Ã€/g, "À")
    .replace(/Ã‰/g, "É")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ãƒ/g, "Ã")
    .replace(/Ã•/g, "Õ")
    .replace(/Ã‡/g, "Ç");

  return out;
}
