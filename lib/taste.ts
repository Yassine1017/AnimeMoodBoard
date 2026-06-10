import type { Anime } from "@/types/anime";

export type TasteAnime = {
  anilistId: number;
  title: string;
  genres: string[];
  episodes?: number | null;
  averageScore?: number | null;
  status?: string | null;
  rating?: number | null;
};

export type TasteProfile = {
  savedAnimeCount: number;
  ratedAnimeCount: number;
  savedAnimeIds: number[];
  topGenres: string[];
  genreWeights: Record<string, number>;
  preferredEpisodeCount?: number;
  averageRating?: number;
  likedAnime: TasteAnime[];
  completedAnime: TasteAnime[];
};

export function buildTasteProfile(items: TasteAnime[]): TasteProfile {
  const genreWeights = new Map<string, number>();
  const likedAnime = items.filter((item) => !item.rating || item.rating >= 7);
  const completedAnime = items.filter((item) => item.status === "completed");
  const ratedAnime = items.filter((item) => item.rating);
  let episodeTotal = 0;
  let episodeCount = 0;
  let ratingTotal = 0;

  items.forEach((item) => {
    const weight = item.rating ? Math.max(1, item.rating / 2) : 2;

    item.genres.forEach((genre) => {
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight);
    });

    if (item.episodes) {
      episodeTotal += item.episodes;
      episodeCount += 1;
    }

    if (item.rating) {
      ratingTotal += item.rating;
    }
  });

  const topGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);

  return {
    savedAnimeCount: items.length,
    ratedAnimeCount: ratedAnime.length,
    savedAnimeIds: items.map((item) => item.anilistId),
    topGenres,
    genreWeights: Object.fromEntries(genreWeights),
    preferredEpisodeCount: episodeCount
      ? Math.round(episodeTotal / episodeCount)
      : undefined,
    averageRating: ratedAnime.length
      ? Number((ratingTotal / ratedAnime.length).toFixed(1))
      : undefined,
    likedAnime: likedAnime.slice(0, 8),
    completedAnime: completedAnime.slice(0, 8),
  };
}

export function scoreAnimeForTaste(anime: Anime, taste?: TasteProfile) {
  if (!taste?.savedAnimeCount) {
    return 0;
  }

  let score = 0;

  anime.genres.forEach((genre) => {
    score += taste.genreWeights[genre] ?? 0;
  });

  if (anime.episodes && taste.preferredEpisodeCount) {
    const distance = Math.abs(anime.episodes - taste.preferredEpisodeCount);
    score += Math.max(0, 4 - distance / 8);
  }

  if (anime.averageScore) {
    score += anime.averageScore / 35;
  }

  return score;
}

export function buildTasteReason(anime: Anime, taste?: TasteProfile) {
  const matchingGenres =
    taste?.topGenres.filter((genre) => anime.genres.includes(genre)).slice(0, 2) ??
    [];

  if (matchingGenres.length) {
    return `Taste-aware pick: it overlaps with your ${matchingGenres.join(" and ")} saves while staying spoiler-free.`;
  }

  if (taste?.preferredEpisodeCount && anime.episodes) {
    return "Taste-aware pick: its episode count is close to the watch length your library suggests.";
  }

  return "Taste-aware pick: it balances your mood with popular AniList signals and your saved anime profile.";
}
