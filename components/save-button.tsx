"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark } from "lucide-react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type SaveButtonProps = {
  anime: Anime;
  compact?: boolean;
};

export function SaveButton({ anime, compact }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    let active = true;

    async function loadSavedState() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return;
      }

      const { data } = await supabase
        .from("saved_anime")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("anilist_id", anime.id)
        .maybeSingle();

      if (active) {
        setSaved(Boolean(data));
      }
    }

    loadSavedState();

    return () => {
      active = false;
    };
  }, [anime.id, supabase]);

  async function ensureUserId() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      return session.user.id;
    }

    const { data, error: signInError } = await supabase.auth.signInAnonymously();

    if (signInError || !data.user) {
      throw new Error(
        "Anonymous auth is not enabled in Supabase. Enable it in Authentication settings or add a sign-in screen."
      );
    }

    return data.user.id;
  }

  async function cacheAnime() {
    const { error: cacheError } = await supabase.from("anime_cache").upsert(
      {
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
      },
      { onConflict: "anilist_id" }
    );

    if (cacheError) {
      throw cacheError;
    }
  }

  async function toggleSaved() {
    setLoading(true);
    setError("");

    try {
      const userId = await ensureUserId();
      await cacheAnime();

      if (saved) {
        const { error: deleteError } = await supabase
          .from("saved_anime")
          .delete()
          .eq("user_id", userId)
          .eq("anilist_id", anime.id);

        if (deleteError) {
          throw deleteError;
        }

        setSaved(false);
        return;
      }

      const { error: saveError } = await supabase.from("saved_anime").upsert(
        {
          user_id: userId,
          anilist_id: anime.id,
          status: "saved",
        },
        { onConflict: "user_id,anilist_id" }
      );

      if (saveError) {
        throw saveError;
      }

      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update saved anime."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="relative inline-flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? `Saved anime ${anime.id}` : `Save anime ${anime.id}`}
        disabled={loading}
        title={error || (saved ? "Saved" : "Save")}
        onClick={toggleSaved}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/8 text-sm font-semibold text-white transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60",
          saved && "border-ember bg-ember text-ink hover:bg-[#ff7a91]",
          error && "border-red-400 text-red-100",
          compact ? "h-9 w-9" : "h-11 gap-2 px-4"
        )}
      >
        <Bookmark
          className={cn("h-4 w-4", saved && "fill-current")}
          aria-hidden="true"
        />
        {compact ? null : loading ? "Saving..." : saved ? "Saved" : "Save"}
      </button>
      {!compact && error ? (
        <span className="max-w-64 text-right text-xs leading-5 text-red-200">
          {error}
        </span>
      ) : null}
    </span>
  );
}
