"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { AnimeGrid } from "@/components/anime-grid";
import { EmptyState } from "@/components/empty-state";
import { MoodSearch } from "@/components/mood-search";
import { RecommendationFeedback } from "@/components/recommendation-feedback";
import { createOptionalBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecommendationResponse } from "@/types/anime";

type RecommendationsClientProps = {
  mood: string;
};

export function RecommendationsClient({ mood }: RecommendationsClientProps) {
  const supabase = useMemo(() => createOptionalBrowserSupabaseClient(), []);
  const [recommendation, setRecommendation] =
    useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadRecommendations() {
      setLoading(true);
      setError("");

      try {
        const headers: Record<string, string> = {};

        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }
        }

        const response = await fetch(
          `/api/recommend?mood=${encodeURIComponent(mood)}`,
          {
            cache: "no-store",
            headers,
            signal: controller.signal,
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || "Recommendations could not be loaded right now."
          );
        }

        if (active) {
          setRecommendation(payload as RecommendationResponse);
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        if (active) {
          setRecommendation(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Recommendations could not be loaded right now."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      active = false;
      controller.abort();
    };
  }, [mood, supabase]);

  useEffect(() => {
    function handleHiddenAnime(event: Event) {
      const animeId = (event as CustomEvent<{ animeId?: number }>).detail?.animeId;

      if (!animeId) {
        return;
      }

      setRecommendation((current) =>
        current
          ? {
              ...current,
              results: current.results.filter(
                (result) => result.anime.id !== animeId
              ),
            }
          : current
      );
    }

    window.addEventListener("anime-hidden", handleHiddenAnime);

    return () => {
      window.removeEventListener("anime-hidden", handleHiddenAnime);
    };
  }, []);

  const personalization = recommendation?.personalization;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(360px,0.6fr)] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Recommendations
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
            {mood}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
            {personalization
              ? getPersonalizationCopy(personalization.mode)
              : "Building spoiler-free picks from AniList and your taste signals."}
          </p>
          {personalization ? (
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-md border border-white/12 bg-white/[0.055] px-3 py-2 text-sm font-medium text-white/64">
              <Sparkles className="h-4 w-4 shrink-0 text-ember" aria-hidden="true" />
              <span className="truncate">
                {personalization.usedTasteProfile
                  ? `${personalization.savedAnimeCount} saved signal${
                      personalization.savedAnimeCount === 1 ? "" : "s"
                    }`
                  : "Rule-based warm start"}
                {personalization.topGenres.length
                  ? ` - ${personalization.topGenres.slice(0, 3).join(", ")}`
                  : ""}
              </span>
            </div>
          ) : null}
        </div>
        <MoodSearch defaultValue={mood} />
      </section>

      {loading ? (
        <RecommendationSkeleton />
      ) : error ? (
        <EmptyState title="AniList is taking a breather" description={error} />
      ) : recommendation?.results.length ? (
        <>
          <RecommendationFeedback
            mood={recommendation.mood}
            topResult={recommendation.results[0]}
          />
          <AnimeGrid
            results={recommendation.results}
            mood={recommendation.mood}
            showHideAction
          />
        </>
      ) : (
        <EmptyState
          title="No matches yet"
          description="Try a broader mood like emotional, cozy, dark thriller, sports, or short."
        />
      )}
    </main>
  );
}

function RecommendationSkeleton() {
  return (
    <div>
      <p className="mb-4 text-sm font-medium text-white/48">
        Ranking your moodboard
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-line bg-white/[0.045]"
          >
            <div className="aspect-[2/3] animate-pulse bg-white/8" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-white/8" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-white/8" />
              <div className="h-16 animate-pulse rounded bg-white/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPersonalizationCopy(
  mode: NonNullable<RecommendationResponse["personalization"]>["mode"]
) {
  if (mode === "ai") {
    return "Spoiler-free picks ranked with your saved taste profile and AI refinement.";
  }

  if (mode === "taste-aware") {
    return "Spoiler-free picks ranked with simple mood filters and your saved taste profile.";
  }

  return "Spoiler-free picks matched with simple mood filters. Save anime to personalize future boards.";
}
