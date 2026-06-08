import type { Anime, RecommendationResult } from "@/types/anime";

export function animeTitle(title: Anime["title"]) {
  return title.english || title.romaji || title.native || "Untitled anime";
}

export function cleanDescription(description?: string | null) {
  if (!description) {
    return "";
  }

  return description
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\(Source:.*?\)/gi, "")
    .replace(/~!.*?!~/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapAnimeToRecommendation(
  anime: Anime,
  reason: string
): RecommendationResult {
  return {
    anime,
    reason,
    matchedFilters: [],
  };
}
