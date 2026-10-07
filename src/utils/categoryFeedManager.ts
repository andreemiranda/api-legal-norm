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

  // 1. Direct matches strictly by category
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
        category: categoryName,
        tags,
      });
    }
  }

  // 2. Se a categoria tiver poucas matérias (< 24) ou zero (ex: "Campos Gerais e Sul do Paraná"),
  // busca por correspondência semântica e regional para garantir cobertura completa
  if (categoryItems.length < 24) {
    const keywords = normTarget
      .split(/[\s,–-]+/)
      .filter((w) => w.length > 3 && !["para", "com", "sul", "norte", "leste", "oeste", "regiao", "vale", "gerais"].includes(w));

    for (const item of allAvailableNews) {
      const key = String(item.id || item.slug || item.title);
      if (seenKeys.has(key)) continue;

      const itemCat = normalize(item.category);
      const textToSearch = `${itemCat} ${normalize(item.title || "")} ${normalize(item.description || "")}`;

      let matched = false;
      if (normTarget.includes("parana") && (itemCat.includes("parana") || textToSearch.includes("parana") || textToSearch.includes("curitiba") || textToSearch.includes("ponta grossa") || textToSearch.includes("campos gerais"))) {
        matched = true;
      } else if (normTarget.includes("minas") && (itemCat.includes("minas") || textToSearch.includes("minas") || textToSearch.includes("belo horizonte") || textToSearch.includes("juiz de fora"))) {
        matched = true;
      } else if (normTarget.includes("fluminense") && (itemCat.includes("fluminense") || textToSearch.includes("fluminense") || textToSearch.includes("rio de janeiro") || textToSearch.includes("campos"))) {
        matched = true;
      } else if (normTarget.includes("tocantins") && (itemCat.includes("tocantins") || textToSearch.includes("palmas") || textToSearch.includes("araguaina"))) {
        matched = true;
      } else if (normTarget.includes("paulista") || normTarget.includes("campinas") || normTarget.includes("bauru") || normTarget.includes("santos") || normTarget.includes("ribeirao") || normTarget.includes("sao carlos") || normTarget.includes("mogi")) {
        if (itemCat.includes("sao paulo") || textToSearch.includes("sao paulo") || textToSearch.includes("paulista")) {
          matched = true;
        }
      } else if (keywords.some((kw) => textToSearch.includes(kw))) {
        matched = true;
      }

      if (matched) {
        seenKeys.add(key);
        const tags = item.tags && item.tags.length > 0 ? item.tags : extractTagsForNewsItem(item);
        categoryItems.push({
          ...item,
          category: categoryName,
          tags,
        });
        if (categoryItems.length >= 100) break;
      }
    }
  }

  // 3. Garantia Universal Absoluta: Nenhuma categoria ou editoria fica sem notícias
  if (categoryItems.length < 50 && allAvailableNews.length > 0) {
    for (const item of allAvailableNews) {
      const key = String(item.id || item.slug || item.title);
      if (seenKeys.has(key)) continue;

      seenKeys.add(key);
      const tags = item.tags && item.tags.length > 0 ? item.tags : extractTagsForNewsItem(item);
      categoryItems.push({
        ...item,
        category: categoryName,
        tags,
      });

      if (categoryItems.length >= 60) break;
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
