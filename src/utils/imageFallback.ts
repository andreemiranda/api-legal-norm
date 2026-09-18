import { extractPostImages } from "./imageOptimizer";
import { NewsItem } from "../types";

/**
 * Extracts a thumbnail image URL for a news item.
 * Strictly extracts authentic images from content or item fields.
 * NEVER returns Unsplash, SVG, or third-party fallback photos!
 */
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
  if (!item) {
    return "";
  }

  const { featuredImage } = extractPostImages(item as Partial<NewsItem>);
  return featuredImage || "";
}
