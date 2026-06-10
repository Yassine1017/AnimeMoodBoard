import type {
  Anime,
  BrowseAnimeResult,
  BrowseFilters,
  DiscoveryRow,
  MoodFilters,
} from "@/types/anime";

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
  status
  nextAiringEpisode {
    airingAt
    episode
    timeUntilAiring
  }
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

export async function browseAnime(
  filters: BrowseFilters
): Promise<BrowseAnimeResult> {
  const data = await anilistFetch<{
    Page: {
      pageInfo: {
        currentPage: number;
        hasNextPage: boolean;
        lastPage?: number | null;
        perPage: number;
        total?: number | null;
      };
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
        $page: Int
        $perPage: Int
      ) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            currentPage
            hasNextPage
            lastPage
            perPage
            total
          }
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
      page: filters.page ?? 1,
      perPage: filters.perPage ?? 24,
    },
    900
  );

  return {
    results: data.Page.media,
    pageInfo: data.Page.pageInfo,
  };
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

type DiscoveryQuery = {
  description: string;
  genres?: string[];
  maxEpisodes?: number;
  minScore?: number;
  mood: string;
  sort: string[];
  status?: string;
  tags?: string[];
  title: string;
};

const discoveryQueries: DiscoveryQuery[] = [
  {
    title: "Trending this week",
    description: "Popular current picks with strong audience momentum.",
    mood: "trending this week",
    sort: ["TRENDING_DESC", "POPULARITY_DESC"],
  },
  {
    title: "Short gems",
    description: "Compact shows that are easier to finish.",
    mood: "short gems",
    maxEpisodes: 13,
    minScore: 70,
    sort: ["SCORE_DESC", "POPULARITY_DESC"],
  },
  {
    title: "Dark psychological",
    description: "Tense picks with mystery, pressure, and mind games.",
    mood: "dark psychological thriller",
    genres: ["Psychological", "Thriller", "Mystery"],
    tags: ["Psychological"],
    sort: ["POPULARITY_DESC", "SCORE_DESC"],
  },
  {
    title: "Cozy comfort picks",
    description: "Warm, easygoing shows for a softer watch.",
    mood: "cozy slice of life",
    genres: ["Slice of Life", "Comedy"],
    sort: ["POPULARITY_DESC", "SCORE_DESC"],
  },
  {
    title: "Highly rated hidden gems",
    description: "Critically loved picks beyond the obvious first search.",
    mood: "highly rated hidden gems",
    minScore: 82,
    sort: ["SCORE_DESC", "POPULARITY_DESC"],
  },
];

export async function getHomeDiscoveryRows(): Promise<DiscoveryRow[]> {
  const rows = await Promise.all(
    discoveryQueries.map(async (query) => {
      try {
        const results = await fetchDiscoveryAnime(query, 8);

        return {
          title: query.title,
          description: query.description,
          mood: query.mood,
          results: results.map((anime) => ({
            anime,
            matchedFilters: [query.title.toLowerCase()],
            reason: "",
          })),
        };
      } catch {
        return {
          title: query.title,
          description: query.description,
          mood: query.mood,
          results: [],
        };
      }
    })
  );

  return rows.filter((row) => row.results.length);
}

export async function getAiringAnime(perPage = 8): Promise<Anime[]> {
  try {
    return fetchDiscoveryAnime(
      {
        title: "Airing now",
        description: "Currently airing anime.",
        mood: "airing now",
        sort: ["TRENDING_DESC", "POPULARITY_DESC"],
        status: "RELEASING",
      },
      perPage
    );
  } catch {
    return [];
  }
}

async function fetchDiscoveryAnime(
  query: DiscoveryQuery,
  perPage: number
): Promise<Anime[]> {
  const data = await anilistFetch<{
    Page: {
      media: Anime[];
    };
  }>(
    `
      query DiscoveryAnime(
        $genres: [String]
        $tags: [String]
        $maxEpisodes: Int
        $minScore: Int
        $status: MediaStatus
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
            averageScore_greater: $minScore
            status: $status
            sort: $sort
          ) {
            ${animeFields}
          }
        }
      }
    `,
    {
      genres: query.genres?.length ? query.genres : undefined,
      tags: query.tags?.length ? query.tags : undefined,
      maxEpisodes: query.maxEpisodes ? query.maxEpisodes + 1 : undefined,
      minScore: query.minScore ? query.minScore - 1 : undefined,
      status: query.status,
      sort: query.sort,
      perPage,
    },
    900
  );

  return data.Page.media;
}
