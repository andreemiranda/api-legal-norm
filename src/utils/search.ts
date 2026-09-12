// Advanced multi-token, accent-insensitive search engine with relevance scoring
import { NewsItem } from "../types";
import { sanitizePortalText } from "./slug";

function normalizeForSearch(text?: string | null): string {
  if (!text) return "";
  return sanitizePortalText(text)
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Searches news items by keyword or phrase.
 * Matches across title, description, content, category, author, and source site.
 * Scores matches with priority:
 * 1. Exact phrase in title (+100)
 * 2. Exact phrase in description (+50)
 * 3. Exact phrase in content/category (+30)
 * 4. Token/word matches in title (+25 per word)
 * 5. Token/word matches in description/content (+10 per word)
 * 6. All keywords match bonus (+40)
 */
export function searchNews(newsList: NewsItem[], query: string): NewsItem[] {
  if (!query || !query.trim()) {
    return newsList;
  }

  const rawQuery = query.trim();
  const normalizedQuery = normalizeForSearch(rawQuery);
  const queryTokens = normalizedQuery
    .split(/[\s,.-]+/)
    .filter((token) => token.length > 1);

  if (queryTokens.length === 0) {
    return newsList;
  }

  type ScoredItem = { item: NewsItem; score: number };
  const scoredResults: ScoredItem[] = [];

  for (const item of newsList) {
    const normTitle = normalizeForSearch(item.title);
    const normDesc = normalizeForSearch(item.description);
    const normContent = normalizeForSearch(item.content);
    const normCat = normalizeForSearch(item.category);
    const normAuthor = normalizeForSearch(String(item.author || ""));
    const normSource = normalizeForSearch(item.sourceSite);

    let score = 0;

    // 1. Exact phrase matches
    if (normTitle.includes(normalizedQuery)) {
      score += 120;
    }
    if (normDesc.includes(normalizedQuery)) {
      score += 60;
    }
    if (normContent.includes(normalizedQuery)) {
      score += 40;
    }
    if (normCat.includes(normalizedQuery) || normSource.includes(normalizedQuery)) {
      score += 45;
    }

    // 2. Individual word tokens match
    let matchedTokenCount = 0;
    for (const token of queryTokens) {
      let matched = false;
      if (normTitle.includes(token)) {
        score += 30;
        matched = true;
      }
      if (normDesc.includes(token)) {
        score += 15;
        matched = true;
      }
      if (normCat.includes(token) || normSource.includes(token) || normAuthor.includes(token)) {
        score += 15;
        matched = true;
      }
      if (normContent.includes(token)) {
        score += 8;
        matched = true;
      }

      if (matched) {
        matchedTokenCount++;
      }
    }

    // All search tokens found bonus
    if (matchedTokenCount === queryTokens.length) {
      score += 40;
    }

    if (score > 0) {
      scoredResults.push({ item, score });
    }
  }

  // Sort results by relevance score descending, then by publication date descending
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const timeA = a.item.pubDate ? new Date(a.item.pubDate).getTime() : 0;
    const timeB = b.item.pubDate ? new Date(b.item.pubDate).getTime() : 0;
    return timeB - timeA;
  });

  return scoredResults.map((r) => r.item);
}
