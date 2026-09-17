import { extractPostImages, getEditorialFallbackPhoto } from "./imageOptimizer";
import { NewsItem } from "../types";

/**
 * Extracts a thumbnail image URL for a news item.
 * Strictly extracts authentic images from content or item fields.
 * NEVER returns an SVG data URI!
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
    return getEditorialFallbackPhoto();
  }

  const { featuredImage } = extractPostImages(item as Partial<NewsItem>);
  return featuredImage;
}
