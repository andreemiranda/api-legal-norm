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
 * category switch, or refresh, and each individual page/category is sorted strictly
 * from newest to oldest.
 */
export function buildBalancedRotatingFeed(
  allNews: NewsItem[],
  seed?: number,
  pageSize = 12
): NewsItem[] {
  if (!allNews || allNews.length === 0) return [];

  // Group all items by category
  const grouped: Record<string, NewsItem[]> = {};
  for (const item of allNews) {
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
  const shuffledCategories = shuffleArray(categories, seed);

  // Category pointers for round-robin interleaving
  const pointers: Record<string, number> = {};
  for (const cat of shuffledCategories) {
    pointers[cat] = 0;
  }

  const result: NewsItem[] = [];
  const totalItems = allNews.length;

  // Fill page by page: each page of `pageSize` items receives items from different categories
  while (result.length < totalItems) {
    const pageItems: NewsItem[] = [];
    let addedInRound = true;

    while (pageItems.length < pageSize && addedInRound) {
      addedInRound = false;
      for (const cat of shuffledCategories) {
        if (pointers[cat] < grouped[cat].length) {
          pageItems.push(grouped[cat][pointers[cat]]);
          pointers[cat]++;
          addedInRound = true;
          if (pageItems.length >= pageSize) break;
        }
      }
    }

    if (pageItems.length === 0) break;

    // Strict chronological ordering within each page (newest to oldest)
    pageItems.sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a));
    result.push(...pageItems);
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

  // If "Todas", generate a balanced rotating feed where all categories rotate across all pages
  // and each page is strictly newest-to-oldest!
  if (isAll) {
    const rotatingNews = buildBalancedRotatingFeed(allAvailableNews, rotationSeed, 12);
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

  // 1. Direct matches by category
  const directMatches = allAvailableNews.filter(
    (item) => normalize(item.category) === normTarget
  );

  // 2. Secondary matches (mentioning category in title, description or tags)
  const secondaryMatches = allAvailableNews.filter((item) => {
    if (normalize(item.category) === normTarget) return false;
    const title = normalize(item.title);
    const desc = normalize(item.description);
    return title.includes(normTarget) || desc.includes(normTarget);
  });

  // Combine matches deduplicating by ID/slug
  const combinedMap = new Map<string | number, NewsItem>();
  directMatches.forEach((item) => combinedMap.set(item.id || item.slug || Math.random(), item));
  secondaryMatches.forEach((item) => combinedMap.set(item.id || item.slug || Math.random(), item));

  let categoryItems = Array.from(combinedMap.values());

  // 3. Ensure minimum 250 items for this category feed
  if (categoryItems.length < MIN_CATEGORY_FEED_ITEMS) {
    // Fill with contextually adapted items from related categories or general news
    const needed = MIN_CATEGORY_FEED_ITEMS - categoryItems.length;
    const otherItems = allAvailableNews.filter((item) => !combinedMap.has(item.id || item.slug));

    for (let i = 0; i < otherItems.length && categoryItems.length < MIN_CATEGORY_FEED_ITEMS; i++) {
      const donor = otherItems[i];
      // Create a contextualized item for this category feed
      const adaptedItem: NewsItem = {
        ...donor,
        id: `cat_${normTarget}_${donor.id || i}`,
        category: categoryName, // assign requested category
        slug: `${donor.slug || donor.id || i}-cat-${normTarget}`,
        tags: extractTagsForNewsItem({ ...donor, category: categoryName }),
      };
      categoryItems.push(adaptedItem);
    }
  }

  // Ensure every item in the feed has tags
  const finalizedItems = categoryItems.map((item) => {
    const tags = item.tags && item.tags.length > 0
      ? item.tags
      : extractTagsForNewsItem({ ...item, category: categoryName });
    return {
      ...item,
      category: categoryName,
      tags,
    };
  });

  // Strict chronological sorting (newest first)
  finalizedItems.sort((a, b) => {
    const timeA = new Date(a.pubDate || 0).getTime();
    const timeB = new Date(b.pubDate || 0).getTime();
    return timeB - timeA;
  });

  // Compute tag counts for this specific category
  const tags = computeTagCounts(finalizedItems);

  return {
    category: categoryName,
    total: finalizedItems.length,
    tag_count: tags.length,
    tags,
    items: finalizedItems,
  };
}
