import { NewsItem } from "../types";

/**
 * Normalizes and extracts timestamp from a NewsItem safely.
 */
export function getNewsTimestamp(item: NewsItem): number {
  if (!item || !item.pubDate) return 0;
  const t = new Date(item.pubDate).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Sorts any list of news items strictly from newest to oldest.
 */
export function sortNewsChronological(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a));
}

/**
 * Generates a high-entropy random rotation seed.
 */
export function getRandomSeed(): number {
  return Math.floor(Math.random() * 10000000);
}

/**
 * Shuffles an array randomly using Fisher-Yates with an optional seed.
 * If seed is provided, generates a deterministic pseudo-random permutation
 * without any alphabetical or sequential patterns.
 */
export function shuffleArray<T>(array: T[], seed?: number): T[] {
  const result = [...array];
  if (result.length <= 1) return result;

  let s = typeof seed === "number" && !isNaN(seed) ? Math.floor(Math.abs(seed)) + 1337 : Math.floor(Math.random() * 10000000) + 1;
  const nextRandom = () => {
    // 32-bit linear congruential generator (Knuth)
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Groups news items by category, with each category array sorted newest to oldest.
 */
export function groupNewsByCategory(news: NewsItem[]): Record<string, NewsItem[]> {
  const grouped: Record<string, NewsItem[]> = {};
  for (const item of news) {
    const cat = item.category?.trim() || "Geral";
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(item);
  }
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a));
  }
  return grouped;
}

/**
 * Retrieves list of unique categories available in the news items.
 */
export function getAvailableCategories(news: NewsItem[]): string[] {
  const catSet = new Set<string>();
  for (const item of news) {
    if (item.category?.trim()) {
      catSet.add(item.category.trim());
    }
  }
  return Array.from(catSet);
}

export interface SectionEditorialResult {
  items: NewsItem[];
  featuredCategory: string;
  isFiltered: boolean;
  totalCategoryArticles: number;
}

/**
 * News for "Radar Editorial • Destaques da Redação" (Above footer).
 * - When an editoria is clicked: MUST show ONLY news from that editoria (newest first).
 * - When "Todas": Rotates to a RANDOM editoria (not alphabetical) on every page refresh or manual click.
 */
export function getRadarEditorialNews(
  allNews: NewsItem[],
  selectedCategory: string,
  rotationSeed: number,
  limit = 8
): SectionEditorialResult {
  if (selectedCategory && selectedCategory !== "Todas") {
    const matched = sortNewsChronological(
      allNews.filter((n) => n.category?.toLowerCase() === selectedCategory.toLowerCase())
    );
    return {
      items: matched.slice(0, limit),
      featuredCategory: selectedCategory,
      isFiltered: true,
      totalCategoryArticles: matched.length,
    };
  }

  const sorted = sortNewsChronological(allNews).slice(0, limit);
  return {
    items: sorted,
    featuredCategory: "Geral",
    isFiltered: false,
    totalCategoryArticles: sorted.length,
  };
}

export function getCarouselNews(
  allNews: NewsItem[],
  selectedCategory: string,
  rotationSeed: number,
  limit = 6
): SectionEditorialResult {
  if (selectedCategory && selectedCategory !== "Todas") {
    const matched = sortNewsChronological(
      allNews.filter((n) => n.category?.toLowerCase() === selectedCategory.toLowerCase())
    );
    return {
      items: matched.slice(0, limit),
      featuredCategory: selectedCategory,
      isFiltered: true,
      totalCategoryArticles: matched.length,
    };
  }

  const sorted = sortNewsChronological(allNews).slice(0, limit);
  return {
    items: sorted,
    featuredCategory: "Geral",
    isFiltered: false,
    totalCategoryArticles: sorted.length,
  };
}

export function getSidebarNews(
  allNews: NewsItem[],
  selectedCategory: string,
  rotationSeed: number,
  limit = 5
): SectionEditorialResult {
  if (selectedCategory && selectedCategory !== "Todas") {
    const matched = sortNewsChronological(
      allNews.filter((n) => n.category?.toLowerCase() === selectedCategory.toLowerCase())
    );
    return {
      items: matched.slice(0, limit),
      featuredCategory: selectedCategory,
      isFiltered: true,
      totalCategoryArticles: matched.length,
    };
  }

  const sorted = sortNewsChronological(allNews).slice(0, limit);
  return {
    items: sorted,
    featuredCategory: "Geral",
    isFiltered: false,
    totalCategoryArticles: sorted.length,
  };
}
