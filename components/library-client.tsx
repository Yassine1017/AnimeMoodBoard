"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  Clock3,
  Library,
  Star,
  Trash2,
} from "lucide-react";

import { ContinueWatching } from "@/components/continue-watching";
import { EmptyState } from "@/components/empty-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SavedStatus = "saved" | "watching" | "completed";
type LibraryTab = SavedStatus | "ratings";

type CachedAnime = {
  anilist_id: number;
  title_romaji: string | null;
  title_english: string | null;
  title_native: string | null;
  poster_url: string | null;
  banner_url: string | null;
  average_score: number | null;
  episodes: number | null;
  genres: string[] | null;
  season: string | null;
  season_year: number | null;
};

type SavedAnimeRow = {
  id: string;
  status: string;
  note: string | null;
  progress_episode?: number | null;
  last_watched_at?: string | null;
  created_at: string;
  anime: CachedAnime | CachedAnime[] | null;
};

type RatingRow = {
  anilist_id: number;
  rating: number;
};

type SavedAnime = {
  id: string;
  status: SavedStatus;
  note: string | null;
  createdAt: string;
  anime: CachedAnime;
  rating: number | null;
  progressEpisode: number;
  lastWatchedAt: string | null;
};

const statusOptions: Array<{ label: string; value: SavedStatus }> = [
  { label: "Saved", value: "saved" },
  { label: "Watching", value: "watching" },
  { label: "Completed", value: "completed" },
];

const tabConfig: Array<{
  label: string;
  value: LibraryTab;
  icon: typeof Bookmark;
}> = [
  { label: "Saved", value: "saved", icon: Bookmark },
  { label: "Watching", value: "watching", icon: Clock3 },
  { label: "Completed", value: "completed", icon: CheckCircle2 },
  { label: "Ratings", value: "ratings", icon: Star },
];

export function LibraryClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [savedAnime, setSavedAnime] = useState<SavedAnime[]>([]);
  const [activeTab, setActiveTab] = useState<LibraryTab>("saved");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function initializeLibrary() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      await loadSavedAnime(session?.user.id);
    }

    initializeLibrary();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSavedAnime(session?.user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function loadSavedAnime(userId?: string) {
    setLoading(true);
    setError("");

    if (!userId) {
      setSavedAnime([]);
      setLoading(false);
      return;
    }

    const progressSelect = `
      id,
      status,
      note,
      progress_episode,
      last_watched_at,
      created_at,
      anime:anime_cache (
        anilist_id,
        title_romaji,
        title_english,
        title_native,
        poster_url,
        banner_url,
        average_score,
        episodes,
        genres,
        season,
        season_year
      )
    `;
    const legacySelect = `
      id,
      status,
      note,
      created_at,
      anime:anime_cache (
        anilist_id,
        title_romaji,
        title_english,
        title_native,
        poster_url,
        banner_url,
        average_score,
        episodes,
        genres,
        season,
        season_year
      )
    `;
    const progressResponse = await supabase
      .from("saved_anime")
      .select(progressSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    let data = progressResponse.data;
    let savedError = progressResponse.error;

    if (savedError && isMissingProgressColumn(savedError.message)) {
      setMessage("Run the progress migration to show episode tracking.");
      const legacyResponse = await supabase
        .from("saved_anime")
        .select(legacySelect)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      data = legacyResponse.data as typeof data;
      savedError = legacyResponse.error;
    }

    if (savedError) {
      setError(savedError.message);
      setSavedAnime([]);
      setLoading(false);
      return;
    }

    const normalized = normalizeSavedRows((data ?? []) as SavedAnimeRow[]);
    const ids = normalized.map((item) => item.anime.anilist_id);
    const ratingsByAnime = new Map<number, number>();

    if (ids.length) {
      const { data: ratings, error: ratingsError } = await supabase
        .from("anime_ratings")
        .select("anilist_id, rating")
        .eq("user_id", userId)
        .in("anilist_id", ids);

      if (ratingsError) {
        setError(ratingsError.message);
      } else {
        (ratings as RatingRow[] | null)?.forEach((row) => {
          ratingsByAnime.set(row.anilist_id, row.rating);
        });
      }
    }

    setSavedAnime(
      normalized.map((item) => ({
        ...item,
        rating: ratingsByAnime.get(item.anime.anilist_id) ?? null,
      }))
    );
    setLoading(false);
  }

  async function updateStatus(savedId: string, status: SavedStatus) {
    const previous = savedAnime;
    setSavedAnime((current) =>
      current.map((item) => (item.id === savedId ? { ...item, status } : item))
    );
    setError("");

    const { error: statusError } = await supabase
      .from("saved_anime")
      .update({ status })
      .eq("id", savedId);

    if (statusError) {
      setSavedAnime(previous);
      setError(statusError.message);
    } else {
      setMessage("Status updated.");
    }
  }

  async function updateRating(item: SavedAnime, rating: number | null) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setError("Sign in or continue as guest to rate anime.");
      return;
    }

    if (rating !== null && !canRateAnime(item)) {
      setError(getRatingLockMessage(item));
      return;
    }

    const previous = savedAnime;
    setSavedAnime((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, rating } : entry
      )
    );
    setError("");

    if (rating === null) {
      const { error: deleteError } = await supabase
        .from("anime_ratings")
        .delete()
        .eq("user_id", session.user.id)
        .eq("anilist_id", item.anime.anilist_id);

      if (deleteError) {
        setSavedAnime(previous);
        setError(deleteError.message);
      }
      return;
    }

    const { error: ratingError } = await supabase.from("anime_ratings").upsert(
      {
        user_id: session.user.id,
        anilist_id: item.anime.anilist_id,
        rating,
      },
      { onConflict: "user_id,anilist_id" }
    );

    if (ratingError) {
      setSavedAnime(previous);
      setError(ratingError.message);
    } else {
      setMessage("Rating saved.");
    }
  }

  async function removeSavedAnime(savedId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const previous = savedAnime;
    const item = savedAnime.find((entry) => entry.id === savedId);
    setSavedAnime((current) => current.filter((entry) => entry.id !== savedId));
    setError("");

    const { error: deleteError } = await supabase
      .from("saved_anime")
      .delete()
      .eq("id", savedId);

    if (deleteError) {
      setSavedAnime(previous);
      setError(deleteError.message);
    } else if (item?.rating && session?.user) {
      await supabase
        .from("anime_ratings")
        .delete()
        .eq("user_id", session.user.id)
        .eq("anilist_id", item.anime.anilist_id);
    }
  }

  const tabCounts = getTabCounts(savedAnime);
  const visibleAnime = getVisibleAnime(savedAnime, activeTab);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Library
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Your saved anime, watch states, and ratings.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            Keep track of what you are watching, what you finished, and which
            shows are ready to rate.
          </p>
        </div>
        <Link
          href="/recommendations?mood=all"
          className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-ember px-4 text-sm font-semibold text-ink transition hover:bg-[#ff7a91]"
        >
          <Library className="h-4 w-4" aria-hidden="true" />
          Browse anime
        </Link>
      </section>

      <ContinueWatching variant="profile" />

      <section className="mt-10">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">All library</h2>
            <p className="mt-2 text-sm text-white/54">
              Manage saved, watching, completed, and rated anime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadCurrentUserLibrary(supabase, loadSavedAnime)}
            className="w-fit rounded-md border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
          >
            Refresh
          </button>
        </div>

        <LibraryTabs
          activeTab={activeTab}
          counts={tabCounts}
          onSelect={setActiveTab}
        />

        {message ? (
          <p className="mt-4 rounded-md border border-aqua/25 bg-aqua/10 px-3 py-2 text-sm text-aqua">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <div className="mt-5">
          {loading ? (
            <SavedAnimeSkeleton />
          ) : visibleAnime.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleAnime.map((item) => (
                <SavedAnimeCard
                  key={item.id}
                  item={item}
                  onRate={updateRating}
                  onRemove={removeSavedAnime}
                  onStatusChange={updateStatus}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={getEmptyTitle(activeTab)}
              description="Save anime from recommendations or detail pages, then organize them here."
            />
          )}
        </div>
      </section>
    </main>
  );
}

type LibraryTabsProps = {
  activeTab: LibraryTab;
  counts: Record<LibraryTab, number>;
  onSelect: (tab: LibraryTab) => void;
};

function LibraryTabs({ activeTab, counts, onSelect }: LibraryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-lg border border-line bg-white/[0.035] p-2">
      {tabConfig.map((tab) => {
        const Icon = tab.icon;
        const selected = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onSelect(tab.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition",
              selected
                ? "bg-ember text-ink"
                : "text-white/64 hover:bg-white/8 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tab.label}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs",
                selected ? "bg-ink/12" : "bg-white/8 text-white/52"
              )}
            >
              {counts[tab.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type SavedAnimeCardProps = {
  item: SavedAnime;
  onRate: (item: SavedAnime, rating: number | null) => void;
  onRemove: (savedId: string) => void;
  onStatusChange: (savedId: string, status: SavedStatus) => void;
};

function SavedAnimeCard({
  item,
  onRate,
  onRemove,
  onStatusChange,
}: SavedAnimeCardProps) {
  const title =
    item.anime.title_english ||
    item.anime.title_romaji ||
    item.anime.title_native ||
    "Untitled anime";
  const poster = item.anime.poster_url;
  const progressPercent =
    item.progressEpisode && item.anime.episodes
      ? Math.min(100, Math.round((item.progressEpisode / item.anime.episodes) * 100))
      : 0;
  const canRate = canRateAnime(item);

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white/[0.045]">
      <Link
        href={`/anime/${item.anime.anilist_id}`}
        className="relative block aspect-[2/3] bg-panel"
      >
        {poster ? (
          <Image
            src={poster}
            alt={`${title} poster`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 260px"
          />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-white/48">
            Poster unavailable
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/92 via-ink/20 to-transparent p-3">
          <span className="rounded-md bg-ink/72 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            {item.anime.average_score ? `${item.anime.average_score}%` : "Saved"}
          </span>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/anime/${item.anime.anilist_id}`}>
              <h3 className="line-clamp-2 text-base font-semibold leading-6 text-white transition hover:text-ember">
                {title}
              </h3>
            </Link>
            <p className="mt-1 text-sm text-white/52">
              {item.anime.episodes
                ? `${item.anime.episodes} episodes`
                : "Episodes TBA"}
            </p>
            <p className="mt-1 text-sm font-medium text-white/68">
              {item.progressEpisode
                ? `Stopped at episode ${item.progressEpisode}`
                : "Not started"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/8 text-white transition hover:border-red-300/40 hover:bg-red-500/12 hover:text-red-100"
            aria-label={`Remove ${title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(item.anime.genres ?? []).slice(0, 3).map((genre) => (
            <span
              key={genre}
              className="rounded-md bg-white/8 px-2 py-1 text-xs font-medium text-white/62"
            >
              {genre}
            </span>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs text-white/42">
            <span>Progress</span>
            <span>
              {item.anime.episodes
                ? `${item.progressEpisode}/${item.anime.episodes}`
                : `${item.progressEpisode} watched`}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-ember"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
          Status
          <select
            value={item.status}
            onChange={(event) =>
              onStatusChange(item.id, event.target.value as SavedStatus)
            }
            className="mt-2 h-10 w-full rounded-md border border-white/12 bg-ink/70 px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-ember focus:ring-2 focus:ring-ember/35"
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
              Rating
            </p>
            {item.rating ? (
              <button
                type="button"
                onClick={() => onRate(item, null)}
                className="text-xs font-semibold text-white/48 transition hover:text-white"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex gap-1">
            {[2, 4, 6, 8, 10].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => onRate(item, rating)}
                disabled={!canRate}
                title={canRate ? `Rate ${rating}/10` : getRatingLockMessage(item)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
                  item.rating && rating <= item.rating
                    ? "border-ember bg-ember text-ink"
                    : "border-white/12 bg-white/8 text-white/56 hover:bg-white/12 hover:text-white"
                )}
                aria-label={`Rate ${title} ${rating} out of 10`}
              >
                <Star
                  className={cn("h-3.5 w-3.5", item.rating && rating <= item.rating && "fill-current")}
                  aria-hidden="true"
                />
              </button>
            ))}
            <span className="ml-2 self-center text-xs font-semibold text-white/48">
              {item.rating ? `${item.rating}/10` : "Not rated"}
            </span>
          </div>
          {!canRate ? (
            <p className="mt-2 text-xs leading-5 text-white/42">
              {getRatingLockMessage(item)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SavedAnimeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-line bg-white/[0.045]"
        >
          <div className="aspect-[2/3] animate-pulse bg-white/8" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-3/4 animate-pulse rounded bg-white/8" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/8" />
            <div className="h-8 animate-pulse rounded bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeSavedRows(rows: SavedAnimeRow[]): SavedAnime[] {
  return rows.flatMap((row) => {
    const anime = Array.isArray(row.anime) ? row.anime[0] : row.anime;

    if (!anime) {
      return [];
    }

    return [
      {
        id: row.id,
        status: normalizeStatus(row.status),
        note: row.note,
        progressEpisode: row.progress_episode ?? 0,
        lastWatchedAt: row.last_watched_at ?? null,
        createdAt: row.created_at,
        anime,
        rating: null,
      },
    ];
  });
}

function normalizeStatus(status: string): SavedStatus {
  if (status === "watching" || status === "completed") {
    return status;
  }

  return "saved";
}

function getVisibleAnime(items: SavedAnime[], tab: LibraryTab) {
  if (tab === "ratings") {
    return items.filter((item) => item.rating !== null);
  }

  return items.filter((item) => item.status === tab);
}

function getTabCounts(items: SavedAnime[]): Record<LibraryTab, number> {
  return {
    saved: items.filter((item) => item.status === "saved").length,
    watching: items.filter((item) => item.status === "watching").length,
    completed: items.filter((item) => item.status === "completed").length,
    ratings: items.filter((item) => item.rating !== null).length,
  };
}

function getEmptyTitle(tab: LibraryTab) {
  if (tab === "watching") {
    return "Nothing marked watching";
  }

  if (tab === "completed") {
    return "No completed anime yet";
  }

  if (tab === "ratings") {
    return "No ratings yet";
  }

  return "No saved anime yet";
}

function canRateAnime(item: SavedAnime) {
  if (item.status === "completed") {
    return true;
  }

  if (!item.anime.episodes) {
    return false;
  }

  return item.progressEpisode > item.anime.episodes / 2;
}

function getRatingLockMessage(item: SavedAnime) {
  if (!item.anime.episodes) {
    return "Episode count is unknown, so mark it completed before rating.";
  }

  const requiredEpisode = Math.floor(item.anime.episodes / 2) + 1;
  return `Watch past episode ${requiredEpisode - 1} to rate this anime.`;
}

function isMissingProgressColumn(message: string) {
  return (
    message.includes("progress_episode") ||
    message.includes("last_watched_at") ||
    message.includes("schema cache")
  );
}

async function loadCurrentUserLibrary(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  loadSavedAnime: (userId?: string) => Promise<void>
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  await loadSavedAnime(session?.user.id);
}
