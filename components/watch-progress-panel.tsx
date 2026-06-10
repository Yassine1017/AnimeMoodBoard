"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Minus, Plus, RotateCcw } from "lucide-react";

import { animeCachePayload } from "@/lib/supabase/anime-cache";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type SavedStatus = "saved" | "watching" | "completed";

type SavedProgress = {
  id: string;
  status: SavedStatus;
  progressEpisode: number;
  lastWatchedAt: string | null;
};

type SavedProgressRow = {
  id: string;
  status: string;
  progress_episode?: number | null;
  last_watched_at?: string | null;
};

type WatchProgressPanelProps = {
  anime: Anime;
};

const statusOptions: Array<{ label: string; value: SavedStatus }> = [
  { label: "Saved", value: "saved" },
  { label: "Watching", value: "watching" },
  { label: "Completed", value: "completed" },
];

export function WatchProgressPanel({ anime }: WatchProgressPanelProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draftEpisode, setDraftEpisode] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsMigration, setNeedsMigration] = useState(false);

  const episodeTotal = anime.episodes ?? null;
  const maxEpisode = episodeTotal ?? 9999;
  const currentEpisode = savedProgress?.progressEpisode ?? 0;
  const nextEpisode =
    episodeTotal && currentEpisode >= episodeTotal ? null : currentEpisode + 1;
  const percent =
    episodeTotal && currentEpisode
      ? Math.min(100, Math.round((currentEpisode / episodeTotal) * 100))
      : 0;

  useEffect(() => {
    let active = true;

    async function loadProgress() {
      setLoading(true);
      setError("");
      setNeedsMigration(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.user) {
        setUserId(null);
        setSavedProgress(null);
        setDraftEpisode(0);
        setLoading(false);
        return;
      }

      setUserId(session.user.id);

      const { data, error: progressError } = await supabase
        .from("saved_anime")
        .select("id, status, progress_episode, last_watched_at")
        .eq("user_id", session.user.id)
        .eq("anilist_id", anime.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (progressError) {
        setSavedProgress(null);
        setDraftEpisode(0);
        setNeedsMigration(isMissingProgressColumn(progressError.message));
        setError(
          isMissingProgressColumn(progressError.message)
            ? "Episode tracking needs the Supabase progress migration."
            : progressError.message
        );
        setLoading(false);
        return;
      }

      const normalized = data
        ? normalizeProgressRow(data as SavedProgressRow)
        : null;
      setSavedProgress(normalized);
      setDraftEpisode(normalized?.progressEpisode ?? 0);
      setLoading(false);
    }

    loadProgress();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [anime.id, supabase]);

  async function ensureUserId() {
    if (userId) {
      return userId;
    }

    const { data, error: signInError } = await supabase.auth.signInAnonymously();

    if (signInError || !data.user) {
      throw new Error(
        "Anonymous auth is not enabled in Supabase. Enable it or sign in first."
      );
    }

    setUserId(data.user.id);
    return data.user.id;
  }

  async function cacheAnime() {
    const { error: cacheError } = await supabase
      .from("anime_cache")
      .upsert(animeCachePayload(anime), { onConflict: "anilist_id" });

    if (cacheError) {
      throw cacheError;
    }
  }

  async function startTracking() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const nextUserId = await ensureUserId();
      await cacheAnime();

      const { data, error: saveError } = await supabase
        .from("saved_anime")
        .upsert(
          {
            user_id: nextUserId,
            anilist_id: anime.id,
            status: "watching",
            progress_episode: 0,
            last_watched_at: null,
          },
          { onConflict: "user_id,anilist_id" }
        )
        .select("id, status, progress_episode, last_watched_at")
        .single();

      if (saveError) {
        throw saveError;
      }

      const normalized = normalizeProgressRow(data as SavedProgressRow);
      setSavedProgress(normalized);
      setDraftEpisode(normalized.progressEpisode);
      setMessage("Tracking started.");
    } catch (startError) {
      handleProgressError(startError);
    } finally {
      setSaving(false);
    }
  }

  async function saveProgress(
    nextEpisodeValue = draftEpisode,
    nextStatus?: SavedStatus
  ) {
    if (!savedProgress) {
      await startTracking();
      return;
    }

    const clampedEpisode = clampEpisode(nextEpisodeValue, maxEpisode);
    const inferredStatus =
      nextStatus ??
      (episodeTotal && clampedEpisode >= episodeTotal
        ? "completed"
        : clampedEpisode > 0
          ? "watching"
          : savedProgress.status);
    const previous = savedProgress;

    setSaving(true);
    setError("");
    setMessage("");
    setSavedProgress({
      ...savedProgress,
      status: inferredStatus,
      progressEpisode: clampedEpisode,
      lastWatchedAt: new Date().toISOString(),
    });
    setDraftEpisode(clampedEpisode);

    const { error: updateError } = await supabase
      .from("saved_anime")
      .update({
        status: inferredStatus,
        progress_episode: clampedEpisode,
        last_watched_at: clampedEpisode ? new Date().toISOString() : null,
      })
      .eq("id", savedProgress.id);

    if (updateError) {
      setSavedProgress(previous);
      setDraftEpisode(previous.progressEpisode);
      handleProgressError(updateError);
    } else {
      setMessage(
        clampedEpisode
          ? `Progress saved at episode ${clampedEpisode}.`
          : "Progress reset."
      );
    }

    setSaving(false);
  }

  async function updateStatus(status: SavedStatus) {
    if (!savedProgress) {
      return;
    }

    const completedEpisode =
      status === "completed" && episodeTotal ? episodeTotal : currentEpisode;
    await saveProgress(completedEpisode, status);
  }

  function handleProgressError(progressError: unknown) {
    const message =
      progressError instanceof Error
        ? progressError.message
        : "Could not save episode progress.";

    setNeedsMigration(isMissingProgressColumn(message));
    setError(
      isMissingProgressColumn(message)
        ? "Run the Supabase progress migration to enable episode tracking."
        : message
    );
  }

  if (loading) {
    return (
      <aside className="rounded-lg border border-line bg-white/[0.045] p-5">
        <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-16 animate-pulse rounded bg-white/8" />
        <div className="mt-4 h-10 animate-pulse rounded bg-white/8" />
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-line bg-white/[0.045] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Watch progress</h2>
          <p className="mt-2 text-sm leading-6 text-white/58">
            {savedProgress
              ? "Synced to your Anime Moodboard profile."
              : "Start tracking to remember your last watched episode."}
          </p>
        </div>
        {savedProgress?.status === "completed" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        ) : null}
      </div>

      <div className="mt-5 rounded-md border border-white/10 bg-ink/42 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
          Stopped at
        </p>
        <p className="mt-2 text-3xl font-semibold text-white">
          {currentEpisode ? `Episode ${currentEpisode}` : "Not started"}
        </p>
        <p className="mt-2 text-sm text-white/54">
          {episodeTotal
            ? currentEpisode
              ? `${currentEpisode} of ${episodeTotal} episodes watched`
              : `${episodeTotal} episodes available`
            : "Episode count is not available from AniList yet."}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-ember transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {savedProgress ? (
        <div className="mt-5 grid gap-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
            Status
            <select
              value={savedProgress.status}
              onChange={(event) =>
                updateStatus(event.target.value as SavedStatus)
              }
              disabled={saving}
              className="mt-2 h-10 w-full rounded-md border border-white/12 bg-ink/70 px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-ember focus:ring-2 focus:ring-ember/35 disabled:opacity-60"
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <label
              className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42"
              htmlFor="progress-episode"
            >
              Last watched episode
            </label>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveProgress(currentEpisode - 1)}
                disabled={saving || currentEpisode <= 0}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Decrease episode progress"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                id="progress-episode"
                type="number"
                min={0}
                max={maxEpisode}
                value={draftEpisode}
                onChange={(event) =>
                  setDraftEpisode(clampEpisode(Number(event.target.value), maxEpisode))
                }
                className="h-10 min-w-0 flex-1 rounded-md border border-white/12 bg-ink/70 px-3 text-center text-sm font-semibold text-white outline-none focus:border-ember focus:ring-2 focus:ring-ember/35"
              />
              <button
                type="button"
                onClick={() => saveProgress(currentEpisode + 1)}
                disabled={saving || currentEpisode >= maxEpisode}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/8 text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Increase episode progress"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <button
              type="button"
              onClick={() => saveProgress(draftEpisode)}
              disabled={saving || draftEpisode === currentEpisode}
              className="inline-flex h-11 items-center justify-center rounded-md bg-ember px-4 text-sm font-semibold text-ink transition hover:bg-[#ff7a91] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save progress"}
            </button>
            <button
              type="button"
              onClick={() => saveProgress(currentEpisode + 1)}
              disabled={saving || nextEpisode === null}
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/12 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {nextEpisode ? `Watched ${nextEpisode}` : "Completed"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                episodeTotal
                  ? saveProgress(episodeTotal, "completed")
                  : updateStatus("completed")
              }
              disabled={saving || savedProgress.status === "completed"}
              className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark completed
            </button>
            <button
              type="button"
              onClick={() => saveProgress(0, "saved")}
              disabled={saving || currentEpisode === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white/78 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </button>
          </div>

          {savedProgress.lastWatchedAt ? (
            <p className="text-xs text-white/42">
              Last updated {new Date(savedProgress.lastWatchedAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={startTracking}
          disabled={saving || needsMigration}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-ember px-4 text-sm font-semibold text-ink transition hover:bg-[#ff7a91] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Starting..." : "Start tracking"}
        </button>
      )}

      {message ? (
        <p className="mt-4 rounded-md border border-aqua/25 bg-aqua/10 px-3 py-2 text-sm text-aqua">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className={cn(
            "mt-4 rounded-md border px-3 py-2 text-sm",
            needsMigration
              ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
              : "border-red-400/25 bg-red-500/10 text-red-100"
          )}
        >
          {error}
        </p>
      ) : null}
    </aside>
  );
}

function normalizeProgressRow(row: SavedProgressRow): SavedProgress {
  return {
    id: row.id,
    status: normalizeStatus(row.status),
    progressEpisode: row.progress_episode ?? 0,
    lastWatchedAt: row.last_watched_at ?? null,
  };
}

function normalizeStatus(status: string): SavedStatus {
  if (status === "watching" || status === "completed") {
    return status;
  }

  return "saved";
}

function clampEpisode(value: number, maxEpisode: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.round(value), maxEpisode));
}

function isMissingProgressColumn(message: string) {
  return (
    message.includes("progress_episode") ||
    message.includes("last_watched_at") ||
    message.includes("schema cache")
  );
}
