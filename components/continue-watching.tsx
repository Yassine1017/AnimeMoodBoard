"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Play, Plus, TimerReset } from "lucide-react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ContinueWatchingProps = {
  variant?: "home" | "profile";
};

type CachedAnime = {
  anilist_id: number;
  title_romaji: string | null;
  title_english: string | null;
  title_native: string | null;
  poster_url: string | null;
  average_score: number | null;
  episodes: number | null;
};

type WatchingRow = {
  id: string;
  progress_episode: number | null;
  last_watched_at: string | null;
  anime: CachedAnime | CachedAnime[] | null;
};

type WatchingItem = {
  id: string;
  progressEpisode: number;
  lastWatchedAt: string | null;
  anime: CachedAnime;
};

export function ContinueWatching({ variant = "home" }: ContinueWatchingProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWatching() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.user) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data, error: watchingError } = await supabase
        .from("saved_anime")
        .select(
          `
            id,
            progress_episode,
            last_watched_at,
            anime:anime_cache (
              anilist_id,
              title_romaji,
              title_english,
              title_native,
              poster_url,
              average_score,
              episodes
            )
          `
        )
        .eq("user_id", session.user.id)
        .eq("status", "watching")
        .order("last_watched_at", { ascending: false });

      if (!active) {
        return;
      }

      if (watchingError) {
        setError(watchingError.message);
        setItems([]);
        setLoading(false);
        return;
      }

      setItems(normalizeRows((data ?? []) as WatchingRow[]).slice(0, 6));
      setLoading(false);
    }

    loadWatching();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function updateProgress(item: WatchingItem, nextEpisode: number) {
    const episodeTotal = item.anime.episodes;
    const clampedEpisode = clampEpisode(nextEpisode, episodeTotal ?? 9999);
    const completed = Boolean(episodeTotal && clampedEpisode >= episodeTotal);
    const previous = items;

    if (completed) {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } else {
      setItems((current) =>
        sortWatchingItems(
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  progressEpisode: clampedEpisode,
                  lastWatchedAt: new Date().toISOString(),
                }
              : entry
          )
        )
      );
    }

    const { error: updateError } = await supabase
      .from("saved_anime")
      .update({
        progress_episode: clampedEpisode,
        status: completed ? "completed" : "watching",
        last_watched_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      setItems(previous);
      setError(updateError.message);
    }
  }

  async function updateStatus(item: WatchingItem, status: "saved" | "completed") {
    const previous = items;
    const progressEpisode =
      status === "completed" && item.anime.episodes
        ? item.anime.episodes
        : item.progressEpisode;

    setItems((current) => current.filter((entry) => entry.id !== item.id));

    const { error: updateError } = await supabase
      .from("saved_anime")
      .update({
        status,
        progress_episode: progressEpisode,
        last_watched_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      setItems(previous);
      setError(updateError.message);
    }
  }

  if (!loading && !items.length && variant === "home") {
    return null;
  }

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8",
        variant === "home" ? "pb-12" : "mt-10 px-0 sm:px-0 lg:px-0"
      )}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Continue Watching
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Pick up where you stopped.
          </h2>
        </div>
        {items.length ? (
          <Link
            href="/profile"
            className="w-fit rounded-md border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
          >
            Manage library
          </Link>
        ) : null}
      </div>

      {loading ? (
        <WatchingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <WatchingCard
              key={item.id}
              item={item}
              onFinishLater={() => updateStatus(item, "saved")}
              onMarkCompleted={() => updateStatus(item, "completed")}
              onWatchedNext={() => updateProgress(item, item.progressEpisode + 1)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-white/[0.045] p-6">
          <p className="text-base font-semibold text-white">
            Nothing in progress yet
          </p>
          <p className="mt-2 text-sm leading-6 text-white/56">
            Open an anime, start tracking, and it will appear here when its
            status is Watching.
          </p>
        </div>
      )}
    </section>
  );
}

type WatchingCardProps = {
  item: WatchingItem;
  onFinishLater: () => void;
  onMarkCompleted: () => void;
  onWatchedNext: () => void;
};

function WatchingCard({
  item,
  onFinishLater,
  onMarkCompleted,
  onWatchedNext,
}: WatchingCardProps) {
  const title =
    item.anime.title_english ||
    item.anime.title_romaji ||
    item.anime.title_native ||
    "Untitled anime";
  const poster = item.anime.poster_url;
  const episodeTotal = item.anime.episodes;
  const percent =
    episodeTotal && item.progressEpisode
      ? Math.min(100, Math.round((item.progressEpisode / episodeTotal) * 100))
      : 0;
  const nextEpisode =
    episodeTotal && item.progressEpisode >= episodeTotal
      ? null
      : item.progressEpisode + 1;

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white/[0.045]">
      <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 p-3">
        <Link
          href={`/anime/${item.anime.anilist_id}`}
          className="relative aspect-[2/3] overflow-hidden rounded-md bg-panel"
        >
          {poster ? (
            <Image
              src={poster}
              alt={`${title} poster`}
              fill
              className="object-cover"
              sizes="104px"
            />
          ) : (
            <div className="grid h-full place-items-center px-2 text-center text-xs text-white/42">
              Poster unavailable
            </div>
          )}
        </Link>

        <div className="min-w-0 py-1">
          <Link href={`/anime/${item.anime.anilist_id}`}>
            <h3 className="line-clamp-2 text-base font-semibold leading-6 text-white transition hover:text-ember">
              {title}
            </h3>
          </Link>
          <p className="mt-1 text-sm font-medium text-white/68">
            Episode {item.progressEpisode || 0}
            {episodeTotal ? ` of ${episodeTotal}` : ""}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-ember"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/42">
            {item.lastWatchedAt
              ? `Updated ${new Date(item.lastWatchedAt).toLocaleDateString()}`
              : "No watch date yet"}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/anime/${item.anime.anilist_id}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ember px-3 text-sm font-semibold text-ink transition hover:bg-[#ff7a91]"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Continue
            </Link>
            <button
              type="button"
              onClick={onWatchedNext}
              disabled={nextEpisode === null}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {nextEpisode ? `Watched ${nextEpisode}` : "Completed"}
            </button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onFinishLater}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white/76 transition hover:bg-white/12"
            >
              <TimerReset className="h-4 w-4" aria-hidden="true" />
              Finish later
            </button>
            <button
              type="button"
              onClick={onMarkCompleted}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Mark completed
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function WatchingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 rounded-lg border border-line bg-white/[0.045] p-3"
        >
          <div className="aspect-[2/3] animate-pulse rounded-md bg-white/8" />
          <div className="space-y-3 py-1">
            <div className="h-5 w-3/4 animate-pulse rounded bg-white/8" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/8" />
            <div className="h-2 animate-pulse rounded bg-white/8" />
            <div className="h-10 animate-pulse rounded bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeRows(rows: WatchingRow[]) {
  return sortWatchingItems(
    rows.flatMap((row) => {
      const anime = Array.isArray(row.anime) ? row.anime[0] : row.anime;

      if (!anime) {
        return [];
      }

      return [
        {
          id: row.id,
          progressEpisode: row.progress_episode ?? 0,
          lastWatchedAt: row.last_watched_at,
          anime,
        },
      ];
    })
  );
}

function sortWatchingItems(items: WatchingItem[]) {
  return [...items].sort((a, b) => {
    const aTime = a.lastWatchedAt ? new Date(a.lastWatchedAt).getTime() : 0;
    const bTime = b.lastWatchedAt ? new Date(b.lastWatchedAt).getTime() : 0;
    return bTime - aTime;
  });
}

function clampEpisode(value: number, maxEpisode: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.round(value), maxEpisode));
}
