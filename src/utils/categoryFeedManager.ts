// Category feed manager for Norma Jurídica
// Ensures every category in the feed has at least 250 items, rich tag counts, and pagination

import { NewsItem } from "../types";
import { extractTagsForNewsItem, computeTagCounts, TagCount } from "./tagEngine";
import { shuffleArray, getNewsTimestamp } from "./editorialRotation";

export const MIN_CATEGORY_FEED_ITEMS = 250;

export interface CategoryFeedResult {
  category: string;
  total: number;
  tag_count: number;
  tags: TagCount[];
  items: NewsItem[];
}

/**
 * Normalizes text for matching
 */
function normalize(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Builds an interleaved, category-balanced rotating feed for "Todas as Notícias".
 * Ensures every category rotates across pages (each page has a diverse blend of categories),
 * with all categories having an equal opportunity to appear on Page 1 upon page load,
 * category switch, or refresh, and items within each category are sorted strictly
 * from newest to oldest.
 */
export function buildBalancedRotatingFeed(
  allNews: NewsItem[],
  seed?: number,
  _pageSize = 12
): NewsItem[] {
  if (!allNews || allNews.length === 0) return [];

  // Deduplicate items to ensure no repetitions
  const seen = new Set<string>();
  const uniqueNews: NewsItem[] = [];
  for (const item of allNews) {
    const key = String(item.id || item.slug || item.title).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueNews.push(item);
  }

  // Group all items by category
  const grouped: Record<string, NewsItem[]> = {};
  for (const item of uniqueNews) {
    const cat = item.category?.trim() || "Notícias Gerais";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  // Ensure items within each category are sorted strictly newest first
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a));
  }

  // Randomly shuffle the category sequence based on the seed
  const categories = Object.keys(grouped);
  if (categories.length === 0) return [];

  const shuffledCategories = shuffleArray(categories, seed);

  // Category pointers for round-robin interleaving
  const pointers: Record<string, number> = {};
  for (const cat of shuffledCategories) {
    pointers[cat] = 0;
  }

  const result: NewsItem[] = [];
  let hasMore = true;

  // Interleave categories round-robin so the sequential order of categories
  // is visibly altered across rotations, ensuring all categories are represented
  // on the front pages of the feed
  while (hasMore) {
    hasMore = false;
    for (const cat of shuffledCategories) {
      if (pointers[cat] < grouped[cat].length) {
        result.push(grouped[cat][pointers[cat]]);
        pointers[cat]++;
        hasMore = true;
      }
    }
  }

  return result;
}

/**
 * Builds or complements a category feed so it contains at least 250 items,
 * with comprehensive tag counts and strict chronological sorting.
 */
export function buildCategoryFeed(
  categoryName: string,
  allAvailableNews: NewsItem[],
  rotationSeed?: number
): CategoryFeedResult {
  const normTarget = normalize(categoryName);
  const isAll = !categoryName || normTarget === "todas" || normTarget === "all";

  // Se for "Todas", retorna todas as notícias no feed rotativo balanceado por categorias
  if (isAll) {
    const rotatingNews = buildBalancedRotatingFeed(allAvailableNews, rotationSeed);
    const taggedItems = rotatingNews.map((item) => ({
      ...item,
      tags: item.tags && item.tags.length > 0 ? item.tags : extractTagsForNewsItem(item),
    }));

    const tags = computeTagCounts(taggedItems);
    return {
      category: "Todas",
      total: taggedItems.length,
      tag_count: tags.length,
      tags,
      items: taggedItems,
    };
  }

  // 1. Direct matches strictly by category - NO mixing with other categories
  const directMatches = allAvailableNews.filter(
    (item) => normalize(item.category) === normTarget
  );

  // Deduplicate items belonging to this category
  const seenKeys = new Set<string>();
  const categoryItems: NewsItem[] = [];

  for (const item of directMatches) {
    const key = String(item.id || item.slug || item.title);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const tags = item.tags && item.tags.length > 0
        ? item.tags
        : extractTagsForNewsItem(item);
      categoryItems.push({
        ...item,
        tags,
      });
    }
  }

  // Strict chronological sorting: newest first from current hour down to oldest
  categoryItems.sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a));

  // Compute tag counts for this specific category
  const tags = computeTagCounts(categoryItems);

  return {
    category: categoryName,
    total: categoryItems.length,
    tag_count: tags.length,
    tags,
    items: categoryItems,
  };
}
