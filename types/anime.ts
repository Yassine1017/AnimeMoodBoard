export type AnimeTitle = {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
};

export type AnimeImage = {
  large?: string | null;
  extraLarge?: string | null;
  color?: string | null;
};

export type AnimeTag = {
  name: string;
  rank?: number | null;
  isMediaSpoiler?: boolean | null;
};

export type Anime = {
  id: number;
  title: AnimeTitle;
  coverImage: AnimeImage;
  bannerImage?: string | null;
  averageScore?: number | null;
  episodes?: number | null;
  genres: string[];
  description?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  tags: AnimeTag[];
  recommendations?: {
    nodes: Array<{
      rating?: number | null;
      mediaRecommendation?: Anime | null;
    }>;
  };
};

export type MoodFilters = {
  genres: string[];
  tags: string[];
  maxEpisodes?: number;
  sort: string[];
  labels: string[];
};

export type RecommendationResult = {
  anime: Anime;
  reason: string;
  matchedFilters: string[];
};

export type RecommendationResponse = {
  mood: string;
  filters: MoodFilters;
  results: RecommendationResult[];
};
