"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Bookmark,
  CheckCircle2,
  Clock3,
  LogOut,
  Mail,
  Radar,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SavedStatus = "saved" | "watching" | "completed";
type ProfileTab = SavedStatus | "ratings";

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

type AuthUser = User & {
  is_anonymous?: boolean;
};

const statusOptions: Array<{ label: string; value: SavedStatus }> = [
  { label: "Saved", value: "saved" },
  { label: "Watching", value: "watching" },
  { label: "Completed", value: "completed" },
];

const tabConfig: Array<{
  label: string;
  value: ProfileTab;
  icon: typeof Bookmark;
}> = [
  { label: "Saved", value: "saved", icon: Bookmark },
  { label: "Watching", value: "watching", icon: Clock3 },
  { label: "Completed", value: "completed", icon: CheckCircle2 },
  { label: "Ratings", value: "ratings", icon: Star },
];

export function ProfileClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [savedAnime, setSavedAnime] = useState<SavedAnime[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("saved");
  const [loading, setLoading] = useState(true);
  const [savingAuth, setSavingAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const user = session?.user as AuthUser | undefined;
  const isAnonymous = Boolean(
    user &&
      (user.is_anonymous ||
        user.app_metadata?.provider === "anonymous" ||
        user.identities?.length === 0)
  );

  useEffect(() => {
    let active = true;

    async function initializeProfile() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      setSession(currentSession);
      await loadSavedAnime(currentSession);
    }

    initializeProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadSavedAnime(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function loadSavedAnime(currentSession = session) {
    setLoading(true);
    setError("");

    if (!currentSession?.user) {
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
      .eq("user_id", currentSession.user.id)
      .order("created_at", { ascending: false });
    let data = progressResponse.data;
    let savedError = progressResponse.error;

    if (
      savedError &&
      isMissingProgressColumn(savedError.message)
    ) {
      setMessage("Run the progress migration to show episode tracking.");
      const legacyResponse = await supabase
        .from("saved_anime")
        .select(legacySelect)
        .eq("user_id", currentSession.user.id)
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
        .eq("user_id", currentSession.user.id)
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

  async function continueAsGuest() {
    setSavingAuth(true);
    setMessage("");
    setError("");

    const { error: signInError } = await supabase.auth.signInAnonymously();

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage("Guest profile ready.");
    }

    setSavingAuth(false);
  }

  async function signOut() {
    setSavingAuth(true);
    setMessage("");
    setError("");
    await supabase.auth.signOut();
    setSavedAnime([]);
    setSavingAuth(false);
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return;
    }

    setSavingAuth(true);
    setMessage("");
    setError("");

    const redirectTo = `${window.location.origin}/profile`;

    const { error: authError } =
      session?.user && isAnonymous
        ? await supabase.auth.updateUser(
            { email: trimmedEmail },
            { emailRedirectTo: redirectTo }
          )
        : await supabase.auth.signInWithOtp({
            email: trimmedEmail,
            options: { emailRedirectTo: redirectTo },
          });

    if (authError) {
      setError(authError.message);
    } else {
      setMessage(
        isAnonymous
          ? "Check your email to upgrade this guest profile."
          : "Check your email for the magic link."
      );
      setEmail("");
    }

    setSavingAuth(false);
  }

  async function handleGoogleAuth() {
    setSavingAuth(true);
    setMessage("");
    setError("");

    const redirectTo = `${window.location.origin}/profile`;
    const { error: authError } =
      session?.user && isAnonymous
        ? await supabase.auth.linkIdentity({
            provider: "google",
            options: { redirectTo },
          })
        : await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo },
          });

    if (authError) {
      setError(
        `${authError.message}. Check that Google provider and manual identity linking are enabled in Supabase.`
      );
      setSavingAuth(false);
    }
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

  const taste = buildTasteProfile(savedAnime);
  const tabCounts = getTabCounts(savedAnime);
  const visibleAnime = getVisibleAnime(savedAnime, activeTab);

  const stats = [
    {
      title: "Saved anime",
      value: String(savedAnime.length),
      icon: Bookmark,
      description: savedAnime.length ? "Synced watchlist." : "No saves yet.",
    },
    {
      title: "Ratings",
      value: String(tabCounts.ratings),
      icon: Star,
      description: tabCounts.ratings ? "Taste signals active." : "Rate saved anime.",
    },
    {
      title: "Taste profile",
      value: taste.topGenres.length ? taste.topGenres[0] : "Warm start",
      icon: Radar,
      description: isAnonymous ? "Guest profile." : "Account profile.",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.62fr)_minmax(320px,0.38fr)] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Profile
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Your anime watchlist and taste profile.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            Save anime, move shows through your watch states, rate what you
            finish, and upgrade the guest profile when you are ready.
          </p>
        </div>
        <AuthPanel
          email={email}
          error={error}
          isAnonymous={isAnonymous}
          loading={savingAuth}
          message={message}
          session={session}
          setEmail={setEmail}
          onEmailAuth={handleEmailAuth}
          onGoogleAuth={handleGoogleAuth}
          onGuest={continueAsGuest}
          onSignOut={signOut}
        />
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {stats.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-lg border border-line bg-white/[0.045] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium text-white/68">{card.title}</h2>
                <Icon className="h-5 w-5 text-ember" aria-hidden="true" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
              <p className="mt-3 text-sm leading-6 text-white/56">
                {card.description}
              </p>
            </article>
          );
        })}
      </section>

      <TasteProfilePanel taste={taste} />

      <section className="mt-10">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Library</h2>
            <p className="mt-2 text-sm text-white/54">
              {session?.user
                ? "Synced from Supabase."
                : "Start as a guest or sign in to save anime."}
            </p>
          </div>
          {session?.user ? (
            <button
              type="button"
              onClick={() => loadSavedAnime()}
              className="w-fit rounded-md border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              Refresh
            </button>
          ) : null}
        </div>

        <ProfileTabs
          activeTab={activeTab}
          counts={tabCounts}
          onSelect={setActiveTab}
        />

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
              description="Save an anime from recommendations or detail pages, then organize it here."
            />
          )}
        </div>
      </section>
    </main>
  );
}

type AuthPanelProps = {
  email: string;
  error: string;
  isAnonymous: boolean;
  loading: boolean;
  message: string;
  session: Session | null;
  setEmail: (email: string) => void;
  onEmailAuth: (event: FormEvent<HTMLFormElement>) => void;
  onGoogleAuth: () => void;
  onGuest: () => void;
  onSignOut: () => void;
};

function AuthPanel({
  email,
  error,
  isAnonymous,
  loading,
  message,
  session,
  setEmail,
  onEmailAuth,
  onGoogleAuth,
  onGuest,
  onSignOut,
}: AuthPanelProps) {
  return (
    <aside className="rounded-lg border border-line bg-white/[0.045] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/58">Account</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-white">
              {session?.user
                ? isAnonymous
                  ? "Guest viewer"
                  : session.user.email ?? "Signed-in viewer"
                : "Not signed in"}
            </p>
            <span
              className={cn(
                "rounded-md px-2 py-1 text-xs font-semibold",
                session?.user
                  ? isAnonymous
                    ? "bg-aqua/10 text-aqua"
                    : "bg-emerald-400/12 text-emerald-200"
                  : "bg-white/8 text-white/58"
              )}
            >
              {session?.user ? (isAnonymous ? "Guest" : "Permanent") : "Local"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/54">
            {session?.user
              ? isAnonymous
                ? "Saves work now. Link Google or email to keep this profile across devices."
                : "Your profile can sync across devices."
              : "Create a session to sync saves."}
          </p>
        </div>
        {session?.user ? (
          <button
            type="button"
            onClick={onSignOut}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white/8 text-white transition hover:bg-white/12 disabled:opacity-60"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3">
        {!session?.user ? (
          <button
            type="button"
            onClick={onGuest}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-md bg-ember px-4 text-sm font-semibold text-ink transition hover:bg-[#ff7a91] disabled:opacity-60"
          >
            {loading ? "Starting..." : "Continue as guest"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onGoogleAuth}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-md border border-white/12 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12 disabled:opacity-60"
        >
          {isAnonymous ? "Link Google account" : "Sign in with Google"}
        </button>

        <form onSubmit={onEmailAuth} className="grid gap-2">
          <label className="sr-only" htmlFor="profile-email">
            Email address
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
              aria-hidden="true"
            />
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={
                isAnonymous ? "Email to upgrade guest profile" : "Email magic link"
              }
              className="h-11 w-full rounded-md border border-white/12 bg-ink/64 pl-10 pr-3 text-sm font-medium text-white outline-none transition placeholder:text-white/38 focus:border-ember focus:ring-2 focus:ring-ember/35"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/12 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : isAnonymous ? "Upgrade with email" : "Send magic link"}
          </button>
        </form>
      </div>

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
    </aside>
  );
}

type ProfileTabsProps = {
  activeTab: ProfileTab;
  counts: Record<ProfileTab, number>;
  onSelect: (tab: ProfileTab) => void;
};

function ProfileTabs({ activeTab, counts, onSelect }: ProfileTabsProps) {
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

type TasteProfile = {
  topGenres: string[];
  summary: string;
  preferredLength: string;
  averageRating: string;
};

function TasteProfilePanel({ taste }: { taste: TasteProfile }) {
  return (
    <section className="mt-10 rounded-lg border border-line bg-white/[0.045] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-aqua" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-white">Taste profile</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/62">{taste.summary}</p>
        </div>
        <div className="grid min-w-0 gap-3 text-sm sm:grid-cols-3 lg:min-w-[520px]">
          <TasteMetric label="Top genres" value={taste.topGenres.join(", ") || "No signal"} />
          <TasteMetric label="Watch length" value={taste.preferredLength} />
          <TasteMetric label="Avg rating" value={taste.averageRating} />
        </div>
      </div>
    </section>
  );
}

function TasteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-ink/35 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-2 font-semibold text-white">{value}</p>
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

function getVisibleAnime(items: SavedAnime[], tab: ProfileTab) {
  if (tab === "ratings") {
    return items.filter((item) => item.rating !== null);
  }

  return items.filter((item) => item.status === tab);
}

function getTabCounts(items: SavedAnime[]): Record<ProfileTab, number> {
  return {
    saved: items.filter((item) => item.status === "saved").length,
    watching: items.filter((item) => item.status === "watching").length,
    completed: items.filter((item) => item.status === "completed").length,
    ratings: items.filter((item) => item.rating !== null).length,
  };
}

function buildTasteProfile(items: SavedAnime[]): TasteProfile {
  if (!items.length) {
    return {
      topGenres: [],
      summary:
        "Save and rate a few anime to build a taste profile. Your top genres and preferred watch length will appear here.",
      preferredLength: "No signal",
      averageRating: "No ratings",
    };
  }

  const genreCounts = new Map<string, number>();
  let episodeTotal = 0;
  let episodeCount = 0;
  let ratingTotal = 0;
  let ratingCount = 0;

  items.forEach((item) => {
    item.anime.genres?.forEach((genre) => {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    });

    if (item.anime.episodes) {
      episodeTotal += item.anime.episodes;
      episodeCount += 1;
    }

    if (item.rating) {
      ratingTotal += item.rating;
      ratingCount += 1;
    }
  });

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  const averageEpisodes = episodeCount ? Math.round(episodeTotal / episodeCount) : 0;
  const preferredLength =
    averageEpisodes === 0
      ? "No signal"
      : averageEpisodes <= 13
        ? "Short series"
        : averageEpisodes <= 26
          ? "One to two cours"
          : "Longer watches";
  const averageRating = ratingCount
    ? `${(ratingTotal / ratingCount).toFixed(1)}/10`
    : "No ratings";

  return {
    topGenres,
    preferredLength,
    averageRating,
    summary: topGenres.length
      ? `Your current profile leans toward ${topGenres.join(", ")}. Ratings will sharpen future recommendations as the library grows.`
      : "Your saved list is active. Add a few more shows to surface stronger genre signals.",
  };
}

function getEmptyTitle(tab: ProfileTab) {
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
