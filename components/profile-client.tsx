"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Bookmark,
  LogOut,
  Mail,
  Radar,
  Star,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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
  created_at: string;
  anime: CachedAnime | CachedAnime[] | null;
};

type SavedAnime = {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  anime: CachedAnime;
};

type AuthUser = User & {
  is_anonymous?: boolean;
};

export function ProfileClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [savedAnime, setSavedAnime] = useState<SavedAnime[]>([]);
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

    const { data, error: savedError } = await supabase
      .from("saved_anime")
      .select(
        `
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
        `
      )
      .eq("user_id", currentSession.user.id)
      .order("created_at", { ascending: false });

    if (savedError) {
      setError(savedError.message);
      setSavedAnime([]);
      setLoading(false);
      return;
    }

    setSavedAnime(normalizeSavedRows((data ?? []) as SavedAnimeRow[]));
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
      setError(authError.message);
      setSavingAuth(false);
    }
  }

  async function removeSavedAnime(savedId: string) {
    const previous = savedAnime;
    setSavedAnime((current) => current.filter((item) => item.id !== savedId));
    setError("");

    const { error: deleteError } = await supabase
      .from("saved_anime")
      .delete()
      .eq("id", savedId);

    if (deleteError) {
      setSavedAnime(previous);
      setError(deleteError.message);
    }
  }

  const stats = [
    {
      title: "Saved anime",
      value: String(savedAnime.length),
      icon: Bookmark,
      description: savedAnime.length ? "Ready in your watchlist." : "No saves yet.",
    },
    {
      title: "Ratings",
      value: "0",
      icon: Star,
      description: "Rating controls come next.",
    },
    {
      title: "Taste profile",
      value: savedAnime.length ? "Learning" : "Warm start",
      icon: Radar,
      description: isAnonymous ? "Guest taste profile." : "Synced to your account.",
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
            Your saved anime and taste profile.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            Keep a watchlist, remove anything you are done with, and upgrade the
            guest profile when you are ready.
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

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Saved anime</h2>
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
              className="rounded-md border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              Refresh
            </button>
          ) : null}
        </div>

        {loading ? (
          <SavedAnimeSkeleton />
        ) : savedAnime.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {savedAnime.map((item) => (
              <SavedAnimeCard
                key={item.id}
                item={item}
                onRemove={removeSavedAnime}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved anime yet"
            description="Save an anime from recommendations or detail pages and it will appear here."
          />
        )}
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
          <p className="text-sm font-medium text-white/58">Signed in as</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {session?.user
              ? isAnonymous
                ? "Guest viewer"
                : session.user.email ?? "Signed-in viewer"
              : "Not signed in"}
          </p>
          <p className="mt-1 text-sm text-white/54">
            {session?.user
              ? isAnonymous
                ? "Anonymous Supabase profile"
                : "Permanent Supabase profile"
              : "Create a session to sync saves"}
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
          {isAnonymous ? "Link Google" : "Sign in with Google"}
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
            {loading ? "Sending..." : isAnonymous ? "Upgrade with email" : "Send link"}
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

type SavedAnimeCardProps = {
  item: SavedAnime;
  onRemove: (savedId: string) => void;
};

function SavedAnimeCard({ item, onRemove }: SavedAnimeCardProps) {
  const title =
    item.anime.title_english ||
    item.anime.title_romaji ||
    item.anime.title_native ||
    "Untitled anime";
  const poster = item.anime.poster_url;

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white/[0.045]">
      <Link href={`/anime/${item.anime.anilist_id}`} className="relative block aspect-[2/3] bg-panel">
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
              {item.anime.episodes ? `${item.anime.episodes} episodes` : "Episodes TBA"}
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
        <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-white/42">
          {item.status}
        </p>
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
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
        anime,
      },
    ];
  });
}
