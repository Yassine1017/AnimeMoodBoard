"use client";

import { useMemo, useState } from "react";
import { EyeOff } from "lucide-react";

import { createOptionalBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type HideAnimeButtonProps = {
  anime: Anime;
};

export function HideAnimeButton({ anime }: HideAnimeButtonProps) {
  const supabase = useMemo(() => createOptionalBrowserSupabaseClient(), []);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function getAccessToken() {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      return session.access_token;
    }

    const { data, error: signInError } = await supabase.auth.signInAnonymously();

    if (signInError || !data.session?.access_token) {
      throw new Error("Sign in is needed before hiding anime.");
    }

    return data.session.access_token;
  }

  async function hideAnime() {
    if (hidden || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/hidden-anime", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anilistId: anime.id,
          reason: "not_interested",
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not hide this anime.");
      }

      setHidden(true);
      window.dispatchEvent(
        new CustomEvent("anime-hidden", {
          detail: {
            animeId: anime.id,
          },
        })
      );
    } catch (hideError) {
      setError(
        hideError instanceof Error ? hideError.message : "Could not hide this anime."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading || hidden}
      title={error || (hidden ? "Hidden" : "Hide from future picks")}
      aria-label={hidden ? `Hidden anime ${anime.id}` : `Hide anime ${anime.id}`}
      onClick={hideAnime}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/8 text-white/72 transition hover:bg-white/12 hover:text-white focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60",
        hidden && "border-aqua/40 bg-aqua/15 text-aqua",
        error && "border-red-400 text-red-100"
      )}
    >
      <EyeOff className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
