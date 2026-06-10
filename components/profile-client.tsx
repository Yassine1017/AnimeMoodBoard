"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Bookmark,
  CheckCircle2,
  Library,
  LogOut,
  Mail,
  Sparkles,
  Star,
} from "lucide-react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type CachedAnime = {
  anilist_id: number;
  episodes: number | null;
  genres: string[] | null;
};

type SavedAnimeRow = {
  id: string;
  status: string;
  anime: CachedAnime | CachedAnime[] | null;
};

type RatingRow = {
  anilist_id: number;
  rating: number;
};

type OnboardedTasteProfile = {
  favoriteGenres: string[];
  dislikedGenres: string[];
  preferredLength: string | null;
  moodKeywords: string[];
  profileSummary: string | null;
};

type OnboardedTasteRow = {
  favorite_genres: string[] | null;
  disliked_genres: string[] | null;
  preferred_episode_count: string | null;
  mood_keywords: string[] | null;
  profile_summary: string | null;
};

type SavedAnime = {
  id: string;
  status: string;
  anime: CachedAnime;
  rating: number | null;
};

type AuthUser = User & {
  is_anonymous?: boolean;
};

type TasteProfile = {
  topGenres: string[];
  summary: string;
  preferredLength: string;
  averageRating: string;
};

export function ProfileClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [savedAnime, setSavedAnime] = useState<SavedAnime[]>([]);
  const [onboardedTaste, setOnboardedTaste] =
    useState<OnboardedTasteProfile | null>(null);
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
      await loadProfileSnapshot(currentSession);
    }

    initializeProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadProfileSnapshot(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function loadProfileSnapshot(currentSession = session) {
    setLoading(true);
    setError("");

    if (!currentSession?.user) {
      setSavedAnime([]);
      setOnboardedTaste(null);
      setLoading(false);
      return;
    }

    const tasteProfilePromise = loadTastePreferences(currentSession.user.id);
    const { data, error: savedError } = await supabase
      .from("saved_anime")
      .select(
        `
          id,
          status,
          anime:anime_cache (
            anilist_id,
            episodes,
            genres
          )
        `
      )
      .eq("user_id", currentSession.user.id)
      .order("created_at", { ascending: false });

    if (savedError) {
      setError(savedError.message);
      setSavedAnime([]);
      setOnboardedTaste(await tasteProfilePromise);
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
    setOnboardedTaste(await tasteProfilePromise);
    setLoading(false);
  }

  async function loadTastePreferences(userId: string) {
    const { data, error: tasteError } = await supabase
      .from("taste_profiles")
      .select(
        "favorite_genres, disliked_genres, preferred_episode_count, mood_keywords, profile_summary"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (tasteError || !data) {
      return null;
    }

    return normalizeOnboardedTaste(data as OnboardedTasteRow);
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

  const taste = buildTasteProfile(savedAnime);
  const ratingsCount = savedAnime.filter((item) => item.rating !== null).length;
  const completedCount = savedAnime.filter(
    (item) => item.status === "completed"
  ).length;
  const watchingCount = savedAnime.filter(
    (item) => item.status === "watching"
  ).length;

  const stats = [
    {
      title: "Saved anime",
      value: loading ? "..." : String(savedAnime.length),
      icon: Bookmark,
      description: savedAnime.length ? "Stored in Library." : "No saves yet.",
    },
    {
      title: "Watching",
      value: loading ? "..." : String(watchingCount),
      icon: Library,
      description: watchingCount ? "Ready to continue." : "Nothing active.",
    },
    {
      title: "Completed",
      value: loading ? "..." : String(completedCount),
      icon: CheckCircle2,
      description: completedCount ? "Finished shows." : "No completions yet.",
    },
    {
      title: "Ratings",
      value: loading ? "..." : String(ratingsCount),
      icon: Star,
      description: ratingsCount ? "Taste signals active." : "Rate from Library.",
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
            Account, sync, and taste profile.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            Manage sign-in here. Your saved anime, watch states, and ratings now
            live in Library.
          </p>
          <div className="mt-6">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/library"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-ember px-4 text-sm font-semibold text-ink transition hover:bg-[#ff7a91]"
              >
                <Library className="h-4 w-4" aria-hidden="true" />
                Open Library
              </Link>
              <Link
                href="/onboarding"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/12 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Tune taste
              </Link>
            </div>
          </div>
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

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <TasteProfilePanel onboardedTaste={onboardedTaste} taste={taste} />
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
                ? "Link Google or email to keep this profile across devices."
                : "Your profile syncs across devices."
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

function TasteProfilePanel({
  onboardedTaste,
  taste,
}: {
  onboardedTaste: OnboardedTasteProfile | null;
  taste: TasteProfile;
}) {
  const summary = onboardedTaste?.profileSummary || taste.summary;

  return (
    <section className="mt-10 rounded-lg border border-line bg-white/[0.045] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-aqua" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-white">Taste profile</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/62">{summary}</p>
          <Link
            href="/onboarding"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white transition hover:bg-white/12"
          >
            {onboardedTaste ? "Edit taste setup" : "Start taste setup"}
          </Link>
        </div>
        <div className="grid min-w-0 gap-3 text-sm sm:grid-cols-3 lg:min-w-[520px]">
          <TasteMetric
            label="Favorite genres"
            value={
              onboardedTaste?.favoriteGenres.length
                ? onboardedTaste.favoriteGenres.slice(0, 3).join(", ")
                : taste.topGenres.join(", ") || "No signal"
            }
          />
          <TasteMetric
            label="Watch length"
            value={formatPreferredLength(onboardedTaste?.preferredLength) || taste.preferredLength}
          />
          <TasteMetric
            label="Tones"
            value={
              onboardedTaste?.moodKeywords.length
                ? onboardedTaste.moodKeywords.join(", ")
                : "No tones"
            }
          />
        </div>
      </div>
      {onboardedTaste?.dislikedGenres.length ? (
        <div className="mt-5 rounded-md border border-aqua/20 bg-aqua/10 px-3 py-2 text-sm font-medium text-aqua">
          Down-ranking {onboardedTaste.dislikedGenres.slice(0, 4).join(", ")}.
        </div>
      ) : null}
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

function normalizeSavedRows(rows: SavedAnimeRow[]): SavedAnime[] {
  return rows.flatMap((row) => {
    const anime = Array.isArray(row.anime) ? row.anime[0] : row.anime;

    if (!anime) {
      return [];
    }

    return [
      {
        id: row.id,
        status: row.status,
        anime,
        rating: null,
      },
    ];
  });
}

function normalizeOnboardedTaste(
  row: OnboardedTasteRow
): OnboardedTasteProfile {
  return {
    favoriteGenres: row.favorite_genres ?? [],
    dislikedGenres: row.disliked_genres ?? [],
    preferredLength: row.preferred_episode_count,
    moodKeywords: row.mood_keywords ?? [],
    profileSummary: row.profile_summary,
  };
}

function formatPreferredLength(value?: string | null) {
  if (value === "short") {
    return "Short series";
  }

  if (value === "medium") {
    return "Medium series";
  }

  if (value === "long") {
    return "Longer watches";
  }

  return "";
}

function buildTasteProfile(items: SavedAnime[]): TasteProfile {
  if (!items.length) {
    return {
      topGenres: [],
      summary:
        "Save and rate anime to build a taste profile. Library will keep the detailed watchlist tidy.",
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
      ? `Your current profile leans toward ${topGenres.join(", ")}. Keep saving and rating in Library to sharpen future recommendations.`
      : "Your saved list is active. Add a few more shows to surface stronger genre signals.",
  };
}
