import { verifyNewsImage } from "./imageVerification";
import { createEditorialFallbackSvg } from "./imageOptimizer";

export function extractThumbnail(item: {
  thumbnail?: string;
  imageUrl?: string;
  image?: string;
  content?: string;
  description?: string;
  category?: string;
  title?: string;
  link?: string;
  id?: string | number;
}): string {
  const candidates = [item.thumbnail, item.imageUrl, item.image];

  for (const c of candidates) {
    if (c && typeof c === "string" && c.startsWith("http")) {
      const ver = verifyNewsImage(c, item as any);
      if (ver.valid) return c;
    }
  }

  // Try extracting img tag from content or description
  const combined = (item.content || "") + " " + (item.description || "");
  const match = combined.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1] && match[1].startsWith("http")) {
    const ver = verifyNewsImage(match[1], item as any);
    if (ver.valid) return match[1];
  }
  
  // Return editorial SVG fallback
  return createEditorialFallbackSvg(item.category || "Notícia", item.title);
}
