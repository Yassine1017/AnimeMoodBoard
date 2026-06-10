import { fetchAnimeByMoodFilters, searchAnime } from "@/lib/anilist";
import { rerankAnimeWithOpenAI } from "@/lib/openai/recommendation-engine";
import { createUserSupabaseClient } from "@/lib/supabase/user-server";
import {
  buildTasteProfile,
  buildTasteReason,
  scoreAnimeForTaste,
  type TasteAnime,
  type TasteProfile,
} from "@/lib/taste";
import type {
  Anime,
  MoodFilters,
  RecommendationResponse,
  RecommendationResult,
} from "@/types/anime";

const RESULT_LIMIT = 12;
const CANDIDATE_LIMIT = 24;

const defaultFilters: MoodFilters = {
  genres: ["Drama", "Slice of Life"],
  tags: [],
  sort: ["POPULARITY_DESC", "SCORE_DESC"],
  maxEpisodes: undefined,
  labels: ["thoughtful", "accessible"],
};

type RecommendationBuild = {
  results: RecommendationResult[];
  usedAi: boolean;
};

type TasteContext = {
  userId?: string;
  profile?: TasteProfile;
};

type CachedAnimeRow = {
  anilist_id: number;
  title_romaji: string | null;
  title_english: string | null;
  title_native: string | null;
  average_score: number | null;
  episodes: number | null;
  genres: string[] | null;
};

type SavedTasteRow = {
  status: string | null;
  anime: CachedAnimeRow | CachedAnimeRow[] | null;
};

type RatingRow = {
  anilist_id: number;
  rating: number;
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
  return getPersonalizedRecommendations(mood);
}

export async function getPersonalizedRecommendations(
  mood: string,
  accessToken?: string
): Promise<RecommendationResponse> {
  const filters = moodToFilters(mood);
  const [moodAnime, titleAnime, tasteContext] = await Promise.all([
    fetchWithFallbacks(filters, CANDIDATE_LIMIT),
    searchAnimeByTitle(mood),
    getTasteContext(accessToken),
  ]);
  const anime = mergeTitleAndMoodCandidates(mood, filters, titleAnime, moodAnime);
  const build = await buildRecommendations(mood, filters, anime, tasteContext.profile);

  if (tasteContext.userId) {
    await recordMoodSearch(
      accessToken,
      tasteContext.userId,
      mood,
      filters,
      build.results
    );
  }

  const usedTasteProfile = Boolean(tasteContext.profile?.savedAnimeCount);

  return {
    mood,
    filters,
    results: build.results,
    personalization: {
      mode: build.usedAi ? "ai" : usedTasteProfile ? "taste-aware" : "rule-based",
      usedTasteProfile,
      usedAi: build.usedAi,
      topGenres: tasteContext.profile?.topGenres ?? [],
      averageRating: tasteContext.profile?.averageRating,
      savedAnimeCount: tasteContext.profile?.savedAnimeCount ?? 0,
    },
  };
}

async function searchAnimeByTitle(mood: string) {
  try {
    return await searchAnime(mood);
  } catch {
    return [];
  }
}

function mergeTitleAndMoodCandidates(
  mood: string,
  filters: MoodFilters,
  titleAnime: Anime[],
  moodAnime: Anime[]
) {
  const titleCandidates = getTitleCandidates(mood, filters, titleAnime);

  if (!titleCandidates.length) {
    return moodAnime;
  }

  return uniqueAnime([...titleCandidates, ...moodAnime]);
}

function getTitleCandidates(
  mood: string,
  filters: MoodFilters,
  titleAnime: Anime[]
) {
  if (!titleAnime.length) {
    return [];
  }

  const query = normalizeTitle(mood);
  const hasMoodKeywords = !sameItems(filters.labels, defaultFilters.labels);
  const exactMatches = titleAnime.filter((anime) =>
    animeTitleValues(anime).some((title) => {
      const normalized = normalizeTitle(title);
      return normalized === query || normalized.includes(query);
    })
  );

  if (exactMatches.length) {
    return exactMatches;
  }

  if (!hasMoodKeywords && query.length >= 3) {
    return titleAnime;
  }

  return [];
}

async function buildRecommendations(
  mood: string,
  filters: MoodFilters,
  anime: Anime[],
  tasteProfile?: TasteProfile
): Promise<RecommendationBuild> {
  const rankedAnime = rankCandidatesForTaste(anime, tasteProfile);

  try {
    const aiResults = await rerankAnimeWithOpenAI({
      mood,
      filters,
      candidates: rankedAnime.slice(0, CANDIDATE_LIMIT),
      tasteProfile,
    });

    if (aiResults?.length) {
      return {
        results: buildAiResults(aiResults, rankedAnime, filters),
        usedAi: true,
      };
    }
  } catch (error) {
    console.warn(error);
  }

  return {
    results: rankedAnime.slice(0, RESULT_LIMIT).map((item) => ({
      anime: item,
      reason:
        tasteProfile && scoreAnimeForTaste(item, tasteProfile) > 0
          ? buildTasteReason(item, tasteProfile)
          : buildReason(item, filters),
      matchedFilters: filters.labels,
    })),
    usedAi: false,
  };
}

function buildAiResults(
  aiResults: Awaited<ReturnType<typeof rerankAnimeWithOpenAI>>,
  rankedAnime: Anime[],
  filters: MoodFilters
) {
  const animeById = new Map(rankedAnime.map((anime) => [anime.id, anime]));
  const usedIds = new Set<number>();
  const results: RecommendationResult[] = [];

  for (const item of aiResults ?? []) {
    const anime = animeById.get(item.id);

    if (!anime || usedIds.has(item.id)) {
      continue;
    }

    usedIds.add(item.id);
    results.push({
      anime,
      reason: item.reason,
      matchedFilters: filters.labels,
    });

    if (results.length >= RESULT_LIMIT) {
      return results;
    }
  }

  for (const anime of rankedAnime) {
    if (usedIds.has(anime.id)) {
      continue;
    }

    results.push({
      anime,
      reason: buildReason(anime, filters),
      matchedFilters: filters.labels,
    });

    if (results.length >= RESULT_LIMIT) {
      return results;
    }
  }

  return results;
}

function rankCandidatesForTaste(anime: Anime[], tasteProfile?: TasteProfile) {
  if (!tasteProfile?.savedAnimeCount) {
    return anime;
  }

  const savedAnimeIds = new Set(tasteProfile.savedAnimeIds);
  const unseenAnime = anime.filter((item) => !savedAnimeIds.has(item.id));
  const pool = unseenAnime.length >= 8 ? unseenAnime : anime;

  return [...pool].sort((a, b) => {
    const tasteDelta =
      scoreAnimeForTaste(b, tasteProfile) - scoreAnimeForTaste(a, tasteProfile);

    if (tasteDelta !== 0) {
      return tasteDelta;
    }

    return (b.averageScore ?? 0) - (a.averageScore ?? 0);
  });
}

async function fetchWithFallbacks(
  filters: MoodFilters,
  perPage = RESULT_LIMIT
): Promise<Anime[]> {
  const strictResults = await fetchAnimeByMoodFilters(filters, perPage);

  if (strictResults.length) {
    return strictResults;
  }

  if (filters.tags.length) {
    const withoutTags = await fetchAnimeByMoodFilters(
      {
        ...filters,
        tags: [],
      },
      perPage
    );

    if (withoutTags.length) {
      return withoutTags;
    }
  }

  if (filters.genres.length > 1) {
    const primaryGenre = await fetchAnimeByMoodFilters(
      {
        ...filters,
        genres: [filters.genres[0]],
        tags: [],
      },
      perPage
    );

    if (primaryGenre.length) {
      return primaryGenre;
    }
  }

  return fetchAnimeByMoodFilters(defaultFilters, perPage);
}

async function getTasteContext(accessToken?: string): Promise<TasteContext> {
  if (!accessToken) {
    return {};
  }

  const supabase = createUserSupabaseClient(accessToken);

  if (!supabase) {
    return {};
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {};
  }

  const { data: savedRows, error: savedError } = await supabase
    .from("saved_anime")
    .select(
      `
        status,
        anime:anime_cache (
          anilist_id,
          title_romaji,
          title_english,
          title_native,
          average_score,
          episodes,
          genres
        )
      `
    )
    .eq("user_id", user.id);

  if (savedError) {
    return { userId: user.id };
  }

  const saved = (savedRows ?? []) as SavedTasteRow[];
  const anilistIds = saved.flatMap((row) => {
    const anime = normalizeCachedAnime(row.anime);
    return anime ? [anime.anilist_id] : [];
  });
  const ratingMap = await getRatingsByAnimeId(accessToken, user.id, anilistIds);
  const tasteItems = saved.flatMap((row) => {
    const anime = normalizeCachedAnime(row.anime);

    if (!anime) {
      return [];
    }

    return [
      {
        anilistId: anime.anilist_id,
        title:
          anime.title_english ||
          anime.title_romaji ||
          anime.title_native ||
          `Anime ${anime.anilist_id}`,
        genres: anime.genres ?? [],
        episodes: anime.episodes,
        averageScore: anime.average_score,
        status: row.status,
        rating: ratingMap.get(anime.anilist_id) ?? null,
      },
    ] satisfies TasteAnime[];
  });

  return {
    userId: user.id,
    profile: tasteItems.length ? buildTasteProfile(tasteItems) : undefined,
  };
}

async function getRatingsByAnimeId(
  accessToken: string,
  userId: string,
  anilistIds: number[]
) {
  const ratingMap = new Map<number, number>();

  if (!anilistIds.length) {
    return ratingMap;
  }

  const supabase = createUserSupabaseClient(accessToken);

  if (!supabase) {
    return ratingMap;
  }

  const { data, error } = await supabase
    .from("anime_ratings")
    .select("anilist_id, rating")
    .eq("user_id", userId)
    .in("anilist_id", anilistIds);

  if (error) {
    return ratingMap;
  }

  ((data ?? []) as RatingRow[]).forEach((row) => {
    ratingMap.set(row.anilist_id, row.rating);
  });

  return ratingMap;
}

async function recordMoodSearch(
  accessToken: string | undefined,
  userId: string,
  mood: string,
  filters: MoodFilters,
  results: RecommendationResult[]
) {
  if (!accessToken) {
    return;
  }

  const supabase = createUserSupabaseClient(accessToken);

  if (!supabase) {
    return;
  }

  await supabase.from("mood_searches").insert({
    user_id: userId,
    mood_query: mood,
    filters,
    result_anilist_ids: results.map((result) => result.anime.id),
  });
}

function normalizeCachedAnime(
  anime: CachedAnimeRow | CachedAnimeRow[] | null
) {
  return Array.isArray(anime) ? anime[0] : anime;
}

function uniqueAnime(anime: Anime[]) {
  const seenIds = new Set<number>();
  const results: Anime[] = [];

  for (const item of anime) {
    if (seenIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    results.push(item);
  }

  return results;
}

function animeTitleValues(anime: Anime) {
  return [anime.title.english, anime.title.romaji, anime.title.native].filter(
    (title): title is string => Boolean(title)
  );
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function sameItems(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item) => right.includes(item));
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
