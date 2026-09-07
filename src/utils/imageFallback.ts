export function extractThumbnail(item: {
  thumbnail?: string;
  imageUrl?: string;
  image?: string;
  content?: string;
  description?: string;
  category?: string;
  id?: string | number;
}): string | undefined {
  if (item.thumbnail && item.thumbnail.startsWith("http")) {
    return item.thumbnail;
  }
  
  if (item.imageUrl && item.imageUrl.startsWith("http")) {
    return item.imageUrl;
  }

  if (item.image && item.image.startsWith("http")) {
    return item.image;
  }

  // Try extracting img tag from content or description
  const combined = (item.content || "") + " " + (item.description || "");
  const match = combined.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1] && match[1].startsWith("http")) {
    return match[1];
  }
  
  // No Unsplash. Return undefined to show no image or let the component handle it.
  return undefined;
}
