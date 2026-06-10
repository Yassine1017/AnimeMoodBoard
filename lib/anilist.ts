import type { Anime, BrowseFilters, MoodFilters } from "@/types/anime";

const ANILIST_ENDPOINT =
  process.env.ANILIST_GRAPHQL_ENDPOINT || "https://graphql.anilist.co";

type AniListResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
};

async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown>,
  revalidate = 1800
): Promise<T> {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`AniList request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as AniListResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(" "));
  }

  if (!payload.data) {
    throw new Error("AniList returned no data.");
  }

  return payload.data;
}

const animeFields = `
  id
  title {
    romaji
    english
    native
  }
  coverImage {
    large
    extraLarge
    color
  }
  bannerImage
  averageScore
  episodes
  genres
  description(asHtml: false)
  season
  seasonYear
  format
  tags {
    name
    rank
    isMediaSpoiler
  }
`;

export async function searchAnime(query: string): Promise<Anime[]> {
  const data = await anilistFetch<{
    Page: {
      media: Anime[];
    };
  }>(
    `
      query SearchAnime($search: String) {
        Page(page: 1, perPage: 12) {
          media(
            search: $search
            type: ANIME
            isAdult: false
            sort: [POPULARITY_DESC, SCORE_DESC]
          ) {
            ${animeFields}
          }
        }
      }
    `,
    { search: query }
  );

  return data.Page.media;
}

export async function browseAnime(filters: BrowseFilters): Promise<Anime[]> {
  const data = await anilistFetch<{
    Page: {
      media: Anime[];
    };
  }>(
    `
      query BrowseAnime(
        $search: String
        $genres: [String]
        $seasonYear: Int
        $maxEpisodes: Int
        $minScore: Int
        $sort: [MediaSort]
        $perPage: Int
      ) {
        Page(page: 1, perPage: $perPage) {
          media(
            search: $search
            type: ANIME
            isAdult: false
            genre_in: $genres
            seasonYear: $seasonYear
            episodes_lesser: $maxEpisodes
            averageScore_greater: $minScore
            sort: $sort
          ) {
            ${animeFields}
          }
        }
      }
    `,
    {
      search: filters.query || undefined,
      genres: filters.genre ? [filters.genre] : undefined,
      seasonYear: filters.year,
      maxEpisodes: filters.maxEpisodes ? filters.maxEpisodes + 1 : undefined,
      minScore: filters.minScore ? filters.minScore - 1 : undefined,
      sort: [filters.sort],
      perPage: filters.perPage ?? 24,
    },
    900
  );

  return data.Page.media;
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  if (!Number.isFinite(id)) {
    return null;
  }

  const data = await anilistFetch<{
    Media: Anime | null;
  }>(
    `
      query AnimeById($id: Int) {
        Media(id: $id, type: ANIME, isAdult: false) {
          ${animeFields}
          recommendations(page: 1, perPage: 12, sort: RATING_DESC) {
            nodes {
              rating
              mediaRecommendation {
                ${animeFields}
              }
            }
          }
        }
      }
    `,
    { id }
  );

  return data.Media;
}

export async function fetchAnimeByMoodFilters(
  filters: MoodFilters,
  perPage = 12
): Promise<Anime[]> {
  const data = await anilistFetch<{
    Page: {
      media: Anime[];
    };
  }>(
    `
      query AnimeByMood(
        $genres: [String]
        $tags: [String]
        $maxEpisodes: Int
        $sort: [MediaSort]
        $perPage: Int
      ) {
        Page(page: 1, perPage: $perPage) {
          media(
            type: ANIME
            isAdult: false
            genre_in: $genres
            tag_in: $tags
            episodes_lesser: $maxEpisodes
            averageScore_greater: 62
            sort: $sort
          ) {
            ${animeFields}
          }
        }
      }
    `,
    {
      genres: filters.genres.length ? filters.genres : undefined,
      tags: filters.tags.length ? filters.tags : undefined,
      maxEpisodes: filters.maxEpisodes ? filters.maxEpisodes + 1 : undefined,
      sort: filters.sort,
      perPage,
    }
  );

  return data.Page.media;
}
