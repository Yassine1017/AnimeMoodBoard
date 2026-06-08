import type { MoodFilters } from "@/types/anime";

export type AiRecommendationInput = {
  mood: string;
  filters: MoodFilters;
};

export async function getAiRecommendationPrompt(input: AiRecommendationInput) {
  return {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    system:
      "You are a spoiler-free anime recommendation assistant. Never reveal plot twists.",
    user: `Mood: ${input.mood}\nFilters: ${JSON.stringify(input.filters)}`,
  };
}
