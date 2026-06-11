"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Flame,
  Gem,
  Heart,
  Moon,
  Sparkles,
  Zap,
} from "lucide-react";

import { AnimeGrid } from "@/components/anime-grid";
import { EmptyState } from "@/components/empty-state";
import { RecommendationFeedback } from "@/components/recommendation-feedback";
import { createOptionalBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecommendationResponse } from "@/types/anime";

type SliderKey =
  | "tone"
  | "length"
  | "emotion"
  | "popularity"
  | "intensity";

type SliderState = Record<SliderKey, number>;

type SliderConfig = {
  key: SliderKey;
  left: string;
  right: string;
  icon: typeof Sparkles;
  label: string;
};

const sliderConfig: SliderConfig[] = [
  {
    key: "tone",
    label: "Tone",
    left: "Cozy",
    right: "Dark",
    icon: Moon,
  },
  {
    key: "length",
    label: "Length",
    left: "Short",
    right: "Long",
    icon: Gem,
  },
  {
    key: "emotion",
    label: "Energy",
    left: "Emotional",
    right: "Action-heavy",
    icon: Heart,
  },
  {
    key: "popularity",
    label: "Discovery",
    left: "Popular",
    right: "Hidden gems",
    icon: Sparkles,
  },
  {
    key: "intensity",
    label: "Pace",
    left: "Relaxing",
    right: "Intense",
    icon: Flame,
  },
];

const defaultSliders: SliderState = {
  tone: 32,
  length: 35,
  emotion: 45,
  popularity: 55,
  intensity: 38,
};

const presets: Array<{ label: string; values: SliderState }> = [
  {
    label: "Rainy comfort",
    values: {
      tone: 12,
      length: 28,
      emotion: 22,
      popularity: 48,
      intensity: 12,
    },
  },
  {
    label: "Dark binge",
    values: {
      tone: 88,
      length: 72,
      emotion: 58,
      popularity: 42,
      intensity: 86,
    },
  },
  {
    label: "Hidden emotional gem",
    values: {
      tone: 38,
      length: 36,
      emotion: 8,
      popularity: 88,
      intensity: 34,
    },
  },
  {
    label: "Weekend hype",
    values: {
      tone: 55,
      length: 45,
      emotion: 88,
      popularity: 30,
      intensity: 82,
    },
  },
];

export function TasteLabClient() {
  const supabase = useMemo(() => createOptionalBrowserSupabaseClient(), []);
  const [sliders, setSliders] = useState<SliderState>(defaultSliders);
  const [recommendation, setRecommendation] =
    useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mood = useMemo(() => buildMood(sliders), [sliders]);
  const profile = useMemo(() => buildTasteProfile(sliders), [sliders]);

  useEffect(() => {
    void loadRecommendations(mood);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRecommendations(nextMood = mood) {
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
        `/api/recommend?mood=${encodeURIComponent(nextMood)}`,
        {
          cache: "no-store",
          headers,
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Taste Lab could not load picks.");
      }

      setRecommendation(payload as RecommendationResponse);
    } catch (loadError) {
      setRecommendation(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Taste Lab could not load picks."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateSlider(key: SliderKey, value: number) {
    setSliders((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(values: SliderState) {
    setSliders(values);
    void loadRecommendations(buildMood(values));
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.56fr)_minmax(360px,0.44fr)] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Taste Lab
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Shape the exact anime mood.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            Move the sliders, then rerank recommendations using your taste
            profile, saves, feedback, and AniList signals.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.values)}
                className="rounded-md border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-lg border border-line bg-white/[0.045] p-4 shadow-aura">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-ember">
                <Brain className="h-5 w-5" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-white">Control board</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/54">
                Current query: <span className="text-white/82">{mood}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadRecommendations()}
              disabled={loading}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-ember px-4 text-sm font-semibold text-ink transition hover:bg-[#ff7a91] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              {loading ? "Tuning..." : "Rerank"}
            </button>
          </div>

          <div className="grid gap-4">
            {sliderConfig.map((config) => (
              <TasteSlider
                key={config.key}
                config={config}
                value={sliders[config.key]}
                onChange={(value) => updateSlider(config.key, value)}
              />
            ))}
          </div>
        </section>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(280px,0.3fr)]">
        <div className="rounded-lg border border-ember/25 bg-ember/10 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ember" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white">Taste recipe</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-white/10 bg-ink/45 px-2.5 py-1 text-xs font-semibold text-white/68"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-white/62">{profile.summary}</p>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.045] p-4">
          <h2 className="text-lg font-semibold text-white">Next step</h2>
          <p className="mt-2 text-sm leading-6 text-white/56">
            Save, hide, or rate results so the lab gets sharper across sessions.
          </p>
          <Link
            href="/onboarding"
            className="mt-4 inline-flex h-10 items-center rounded-md border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white"
          >
            Tune base taste
          </Link>
        </div>
      </section>

      <section className="mt-10">
        {loading ? (
          <TasteLabSkeleton />
        ) : error ? (
          <EmptyState title="Taste Lab is unavailable" description={error} />
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
            title="No lab matches yet"
            description="Try a more balanced recipe or rerank with fewer extremes."
          />
        )}
      </section>
    </main>
  );
}

function TasteSlider({
  config,
  onChange,
  value,
}: {
  config: SliderConfig;
  onChange: (value: number) => void;
  value: number;
}) {
  const Icon = config.icon;

  return (
    <div className="rounded-md border border-white/10 bg-ink/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-aqua" aria-hidden="true" />
          <span className="text-sm font-semibold text-white">{config.label}</span>
        </div>
        <span className="rounded bg-white/8 px-2 py-1 text-xs font-semibold text-white/46">
          {value}
        </span>
      </div>
      <input
        aria-label={`${config.left} to ${config.right}`}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-ember"
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-white/44">
        <span>{config.left}</span>
        <span>{config.right}</span>
      </div>
    </div>
  );
}

function TasteLabSkeleton() {
  return (
    <div>
      <p className="mb-4 text-sm font-medium text-white/48">Reranking lab picks</p>
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

function buildMood(sliders: SliderState) {
  const parts = [
    sliders.tone < 35 ? "cozy" : sliders.tone > 65 ? "dark psychological" : "balanced",
    sliders.length < 40
      ? "short under 24 episodes"
      : sliders.length > 65
        ? "long immersive"
        : "medium length",
    sliders.emotion < 35
      ? "emotional character driven"
      : sliders.emotion > 65
        ? "action-heavy hype moments"
        : "story-focused",
    sliders.popularity < 40
      ? "popular accessible"
      : sliders.popularity > 65
        ? "highly rated hidden gems"
        : "well liked",
    sliders.intensity < 35
      ? "relaxing low pressure"
      : sliders.intensity > 65
        ? "intense thrilling"
        : "steady pace",
  ];

  return parts.join(", ");
}

function buildTasteProfile(sliders: SliderState) {
  const tags = [
    sliders.tone < 35 ? "cozy" : sliders.tone > 65 ? "dark" : "balanced tone",
    sliders.length < 40 ? "short" : sliders.length > 65 ? "long-form" : "medium",
    sliders.emotion < 35
      ? "emotional"
      : sliders.emotion > 65
        ? "action-heavy"
        : "mixed energy",
    sliders.popularity < 40
      ? "popular"
      : sliders.popularity > 65
        ? "hidden gems"
        : "balanced discovery",
    sliders.intensity < 35
      ? "relaxing"
      : sliders.intensity > 65
        ? "intense"
        : "steady",
  ];

  return {
    tags,
    summary: `Taste Lab is asking for ${tags.join(", ")} recommendations. These sliders become a mood query, then your saved anime and feedback rerank the final board.`,
  };
}
