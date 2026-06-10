import type { Anime, MoodFilters } from "@/types/anime";
import type { TasteProfile } from "@/lib/taste";

type Candidate = {
  id: number;
  title: string;
  genres: string[];
  averageScore?: number | null;
  episodes?: number | null;
  format?: string | null;
  seasonYear?: number | null;
};

type AiRerankInput = {
  mood: string;
  filters: MoodFilters;
  candidates: Anime[];
  tasteProfile?: TasteProfile;
};

export type AiRerankResult = {
  id: number;
  reason: string;
};

type ResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "reason"],
        properties: {
          id: {
            type: "integer",
          },
          reason: {
            type: "string",
            minLength: 24,
            maxLength: 180,
          },
        },
      },
    },
  },
};

export async function rerankAnimeWithOpenAI({
  mood,
  filters,
  candidates,
  tasteProfile,
}: AiRerankInput): Promise<AiRerankResult[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !candidates.length) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      temperature: 0.2,
      input: [
        {
          role: "system",
          content:
            "You are a spoiler-free anime recommendation engine. Rerank only the supplied AniList candidates. Never invent anime, reveal plot twists, or mention private user data.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Pick the strongest 8-12 recommendations for the mood. Prefer candidates that match the taste profile when it exists. Return concise product-quality reasons.",
            mood,
            moodFilters: filters,
            tasteProfile: tasteProfile
              ? {
                  savedAnimeCount: tasteProfile.savedAnimeCount,
                  ratedAnimeCount: tasteProfile.ratedAnimeCount,
                  topGenres: tasteProfile.topGenres,
                  preferredEpisodeCount: tasteProfile.preferredEpisodeCount,
                  averageRating: tasteProfile.averageRating,
                  likedAnime: tasteProfile.likedAnime,
                  completedAnime: tasteProfile.completedAnime,
                }
              : null,
            candidates: candidates.map(toCandidate),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "anime_recommendation_rerank",
          description:
            "A ranked list of existing AniList candidate ids with concise spoiler-free match reasons.",
          strict: true,
          schema: responseSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI rerank failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ResponsePayload;
  const outputText = extractOutputText(payload);

  if (!outputText) {
    return null;
  }

  const parsed = JSON.parse(outputText) as {
    recommendations?: AiRerankResult[];
  };

  if (!Array.isArray(parsed.recommendations)) {
    return null;
  }

  return parsed.recommendations;
}

function toCandidate(anime: Anime): Candidate {
  return {
    id: anime.id,
    title:
      anime.title.english ||
      anime.title.romaji ||
      anime.title.native ||
      `Anime ${anime.id}`,
    genres: anime.genres,
    averageScore: anime.averageScore,
    episodes: anime.episodes,
    format: anime.format,
    seasonYear: anime.seasonYear,
  };
}

function extractOutputText(payload: ResponsePayload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return null;
}
