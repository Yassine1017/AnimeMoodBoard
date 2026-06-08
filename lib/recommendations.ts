import { fetchAnimeByMoodFilters } from "@/lib/anilist";
import type {
  Anime,
  MoodFilters,
  RecommendationResponse,
} from "@/types/anime";

const defaultFilters: MoodFilters = {
  genres: ["Drama", "Slice of Life"],
  tags: [],
  sort: ["POPULARITY_DESC", "SCORE_DESC"],
  maxEpisodes: undefined,
  labels: ["thoughtful", "accessible"],
};

export function moodToFilters(mood: string): MoodFilters {
  const normalized = mood.toLowerCase();
  const filters: MoodFilters = {
    genres: [],
    tags: [],
    sort: ["POPULARITY_DESC", "SCORE_DESC"],
    maxEpisodes: undefined,
    labels: [],
  };

  if (/\b(dark|psychological|thriller)\b/.test(normalized)) {
    filters.genres.push("Psychological", "Thriller", "Mystery");
    filters.tags.push("Psychological");
    filters.labels.push("tense", "psychological");
  }

  if (/\b(emotional|sad|beautiful|hopeful|romance)\b/.test(normalized)) {
    filters.genres.push("Drama", "Romance", "Slice of Life");
    filters.labels.push("emotional", "character-driven");
  }

  if (/\b(sports|hype|football|soccer|team)\b/.test(normalized)) {
    filters.genres.push("Sports");
    filters.labels.push("high-energy", "team-focused");
  }

  if (/\bshort\b/.test(normalized)) {
    filters.maxEpisodes = 24;
    filters.labels.push("short");
  }

  if (/\b(cozy|relaxing|comfort|calm|slice)\b/.test(normalized)) {
    filters.genres.push("Slice of Life", "Comedy");
    filters.labels.push("cozy", "low-pressure");
  }

  return {
    ...filters,
    genres: unique(filters.genres.length ? filters.genres : defaultFilters.genres),
    tags: unique(filters.tags),
    labels: unique(filters.labels.length ? filters.labels : defaultFilters.labels),
  };
}

export async function getRecommendations(
  mood: string
): Promise<RecommendationResponse> {
  const filters = moodToFilters(mood);
  const anime = await fetchWithFallbacks(filters);

  return {
    mood,
    filters,
    results: anime.slice(0, 12).map((item) => ({
      anime: item,
      reason: buildReason(item, filters),
      matchedFilters: filters.labels,
    })),
  };
}

async function fetchWithFallbacks(filters: MoodFilters): Promise<Anime[]> {
  const strictResults = await fetchAnimeByMoodFilters(filters);

  if (strictResults.length) {
    return strictResults;
  }

  if (filters.tags.length) {
    const withoutTags = await fetchAnimeByMoodFilters({
      ...filters,
      tags: [],
    });

    if (withoutTags.length) {
      return withoutTags;
    }
  }

  if (filters.genres.length > 1) {
    const primaryGenre = await fetchAnimeByMoodFilters({
      ...filters,
      genres: [filters.genres[0]],
      tags: [],
    });

    if (primaryGenre.length) {
      return primaryGenre;
    }
  }

  return fetchAnimeByMoodFilters(defaultFilters);
}

function buildReason(anime: Anime, filters: MoodFilters): string {
  const genres = new Set(anime.genres);

  if (filters.labels.includes("psychological")) {
    return "A tense, mind-game pick with mystery-forward storytelling and no spoiler setup needed.";
  }

  if (filters.labels.includes("high-energy")) {
    return "A sports-focused pick with momentum, rivalry, and payoff-friendly episode structure.";
  }

  if (filters.labels.includes("cozy")) {
    return "A lighter comfort pick built around everyday warmth and easygoing character time.";
  }

  if (filters.labels.includes("short") && anime.episodes && anime.episodes <= 24) {
    return "A compact watch that fits your short-series mood without asking for a huge commitment.";
  }

  if (
    filters.labels.includes("emotional") ||
    genres.has("Drama") ||
    genres.has("Romance")
  ) {
    return "A character-led pick with emotional pull while keeping the premise spoiler-free.";
  }

  return "A popular, well-scored match that overlaps with the mood and genre signals you gave.";
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}
