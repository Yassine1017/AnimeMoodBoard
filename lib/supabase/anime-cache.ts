import type { Anime } from "@/types/anime";

export function animeCachePayload(anime: Anime) {
  return {
    anilist_id: anime.id,
    title_romaji: anime.title.romaji,
    title_english: anime.title.english,
    title_native: anime.title.native,
    poster_url: anime.coverImage.extraLarge || anime.coverImage.large,
    banner_url: anime.bannerImage,
    average_score: anime.averageScore,
    episodes: anime.episodes,
    genres: anime.genres,
    tags: anime.tags,
    season: anime.season,
    season_year: anime.seasonYear,
    description: anime.description,
    updated_at: new Date().toISOString(),
  };
}
