"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, ChevronDown, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

import { animeTitle } from "@/lib/format";
import { createOptionalBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type WhyThisFitsProps = {
  anime: Anime;
  matchedFilters: string[];
  mood?: string;
  reason?: string;
};

type FeedbackAction = "more_like_this" | "less_like_this";

type SimilarSavedRow = {
  anime:
    | {
        title_romaji: string | null;
        title_english: string | null;
        title_native: string | null;
        genres: string[] | null;
      }
    | Array<{
        title_romaji: string | null;
        title_english: string | null;
        title_native: string | null;
        genres: string[] | null;
      }>
    | null;
};

export function WhyThisFits({
  anime,
  matchedFilters,
  mood,
  reason,
}: WhyThisFitsProps) {
  const supabase = useMemo(() => createOptionalBrowserSupabaseClient(), []);
  const [open, setOpen] = useState(false);
  const [similarSaved, setSimilarSaved] = useState<string[]>([]);
  const [loadedSaved, setLoadedSaved] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackAction | null>(null);

  const matchedMood = mood || matchedFilters[0] || "your current board";
  const matchedGenres = anime.genres.slice(0, 3);

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && !loadedSaved) {
      setLoadedSaved(true);
      await loadSimilarSaved();
    }
  }

  async function loadSimilarSaved() {
    if (!supabase || !anime.genres.length) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return;
    }

    const { data } = await supabase
      .from("saved_anime")
      .select(
        `
          anime:anime_cache (
            title_romaji,
            title_english,
            title_native,
            genres
          )
        `
      )
      .eq("user_id", session.user.id)
      .limit(24);

    const genreSet = new Set(anime.genres);
    const similar =
      ((data ?? []) as SimilarSavedRow[])
        .map((row) => (Array.isArray(row.anime) ? row.anime[0] : row.anime))
        .filter(Boolean)
        .filter((savedAnime) =>
          (savedAnime?.genres ?? []).some((genre) => genreSet.has(genre))
        )
        .slice(0, 3)
        .map(
          (savedAnime) =>
            savedAnime?.title_english ||
            savedAnime?.title_romaji ||
            savedAnime?.title_native ||
            "Saved anime"
        ) ?? [];

    setSimilarSaved(similar);
  }

  async function saveFeedback(action: FeedbackAction) {
    setFeedback(action);

    if (!supabase) {
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    await fetch("/api/feedback", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        mood: matchedMood,
        anchorAnime: {
          id: anime.id,
          title: animeTitle(anime.title),
          genres: anime.genres,
        },
      }),
    }).catch(() => undefined);
  }

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase!.auth.getSession();

    if (session?.access_token) {
      return session.access_token;
    }

    const { data } = await supabase!.auth.signInAnonymously();
    return data.session?.access_token;
  }

  return (
    <div className="mt-3 rounded-md border border-white/10 bg-ink/35">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold text-white/76 transition hover:text-white"
      >
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-aqua" aria-hidden="true" />
          Why this fits you
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="border-t border-white/10 px-3 pb-3 pt-2">
          <div className="grid gap-2 text-xs font-medium text-white/62">
            <FitLine label="Mood" value={matchedMood} />
            <FitLine label="Genres" value={matchedGenres.join(", ") || "Flexible"} />
            <FitLine label="Length" value={getLengthFit(anime.episodes)} />
            <FitLine
              label="Similar saved"
              value={similarSaved.length ? similarSaved.join(", ") : "No saved overlap yet"}
            />
          </div>
          {reason ? (
            <p className="mt-3 text-sm leading-6 text-white/68">{reason}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <FeedbackButton
              active={feedback === "more_like_this"}
              icon={ThumbsUp}
              label="More like this"
              onClick={() => saveFeedback("more_like_this")}
            />
            <FeedbackButton
              active={feedback === "less_like_this"}
              icon={ThumbsDown}
              label="Less like this"
              onClick={() => saveFeedback("less_like_this")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FitLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-white/38">{label}</span>
      <span className="max-w-[68%] text-right text-white/72">{value}</span>
    </div>
  );
}

function FeedbackButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof BadgeCheck;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition",
        active
          ? "border-ember bg-ember text-ink"
          : "border-white/12 bg-white/8 text-white/68 hover:bg-white/12 hover:text-white"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {active ? "Saved" : label}
    </button>
  );
}

function getLengthFit(episodes?: number | null) {
  if (!episodes) {
    return "Episode count TBA";
  }

  if (episodes <= 13) {
    return "Short watch";
  }

  if (episodes <= 26) {
    return "Medium watch";
  }

  return "Long-form watch";
}
