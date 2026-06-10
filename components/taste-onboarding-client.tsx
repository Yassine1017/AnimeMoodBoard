"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import { Check, Search, Sparkles, X } from "lucide-react";

import { animeTitle } from "@/lib/format";
import { animeCachePayload } from "@/lib/supabase/anime-cache";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type PreferredLength = "short" | "medium" | "long";

type SearchPayload = {
  results?: Anime[];
  error?: string;
};

const genreOptions = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

const toneOptions = [
  "cozy",
  "dark",
  "emotional",
  "hype",
  "funny",
];

const lengthOptions: Array<{
  label: string;
  value: PreferredLength;
  description: string;
}> = [
  {
    label: "Short",
    value: "short",
    description: "1 cour or movies",
  },
  {
    label: "Medium",
    value: "medium",
    description: "12-26 episodes",
  },
  {
    label: "Long",
    value: "long",
    description: "Bigger journeys",
  },
];

export function TasteOnboardingClient() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [preferredLength, setPreferredLength] =
    useState<PreferredLength>("medium");
  const [tones, setTones] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<Anime[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const ready =
    favoriteGenres.length > 0 &&
    tones.length > 0 &&
    selectedAnime.length >= 3 &&
    !saving;

  async function searchAnime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    setSearching(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/anilist/search?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as SearchPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Could not search AniList.");
      }

      setSearchResults(payload.results ?? []);
    } catch (searchError) {
      setSearchResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Could not search AniList."
      );
    } finally {
      setSearching(false);
    }
  }

  async function saveTasteProfile() {
    if (!ready) {
      setError("Pick genres, tones, and at least 3 anime you already like.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const userId = await ensureUserId();
      const summary = buildSummary(favoriteGenres, tones, preferredLength);

      const { error: profileError } = await supabase
        .from("taste_profiles")
        .upsert(
          {
            user_id: userId,
            favorite_genres: favoriteGenres,
            disliked_genres: dislikedGenres,
            preferred_episode_count: preferredLength,
            mood_keywords: tones,
            profile_summary: summary,
          },
          { onConflict: "user_id" }
        );

      if (profileError) {
        throw profileError;
      }

      for (const anime of selectedAnime) {
        const { error: cacheError } = await supabase
          .from("anime_cache")
          .upsert(animeCachePayload(anime), { onConflict: "anilist_id" });

        if (cacheError) {
          throw cacheError;
        }
      }

      const { error: savedError } = await supabase.from("saved_anime").upsert(
        selectedAnime.map((anime) => ({
          user_id: userId,
          anilist_id: anime.id,
          status: "completed",
          progress_episode: anime.episodes ?? 0,
          last_watched_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,anilist_id" }
      );

      if (savedError) {
        throw savedError;
      }

      setMessage("Taste profile saved.");
      router.push("/profile");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save taste profile."
      );
    } finally {
      setSaving(false);
    }
  }

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
        "Anonymous auth is not enabled. Sign in or enable guest profiles first."
      );
    }

    return data.user.id;
  }

  function toggleSelectedAnime(anime: Anime) {
    setSelectedAnime((current) => {
      if (current.some((item) => item.id === anime.id)) {
        return current.filter((item) => item.id !== anime.id);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, anime];
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.64fr)_minmax(320px,0.36fr)] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Taste setup
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Tune recommendations in two minutes.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            Pick the signals Anime Moodboard should use before your library has
            enough saves and ratings.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.045] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ember" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white">
              {selectedAnime.length}/3 anime selected
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Liked anime are saved as completed so they immediately sharpen your
            profile and recommendations.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <PreferenceSection
          title="Favorite genres"
          description="Choose the lanes you want boosted."
        >
          <ChipGrid
            items={genreOptions}
            selected={favoriteGenres}
            disabledItems={dislikedGenres}
            onToggle={(genre) => toggleListValue(setFavoriteGenres, genre)}
          />
        </PreferenceSection>

        <PreferenceSection
          title="Genres to avoid"
          description="These get down-ranked unless you search for them."
        >
          <ChipGrid
            items={genreOptions}
            selected={dislikedGenres}
            disabledItems={favoriteGenres}
            muted
            onToggle={(genre) => toggleListValue(setDislikedGenres, genre)}
          />
        </PreferenceSection>

        <PreferenceSection
          title="Preferred length"
          description="This helps avoid huge commitments when you want compact shows."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {lengthOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreferredLength(option.value)}
                className={cn(
                  "rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink",
                  preferredLength === option.value
                    ? "border-ember bg-ember text-ink"
                    : "border-white/12 bg-white/8 text-white hover:bg-white/12"
                )}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    preferredLength === option.value
                      ? "text-ink/72"
                      : "text-white/48"
                  )}
                >
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </PreferenceSection>

        <PreferenceSection
          title="Mood tones"
          description="Choose the emotional texture you usually want."
        >
          <ChipGrid
            items={toneOptions}
            selected={tones}
            onToggle={(tone) => toggleListValue(setTones, tone)}
          />
        </PreferenceSection>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-white/[0.045] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Add 3 anime you already like
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Search exact titles and pick up to three. These become your first
              strong taste anchors.
            </p>
          </div>
          <form onSubmit={searchAnime} className="flex gap-2 lg:min-w-[420px]">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search anime</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/46"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a favorite anime"
                className="h-11 w-full rounded-md border border-white/12 bg-ink/64 pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/38 focus:border-ember focus:ring-2 focus:ring-ember/35"
              />
            </label>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="inline-flex h-11 items-center justify-center rounded-md bg-ember px-4 text-sm font-semibold text-ink transition hover:bg-[#ff7a91] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {selectedAnime.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {selectedAnime.map((anime) => (
              <button
                key={anime.id}
                type="button"
                onClick={() => toggleSelectedAnime(anime)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-aqua/25 bg-aqua/10 px-3 text-sm font-semibold text-aqua"
              >
                {animeTitle(anime.title)}
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {searchResults.slice(0, 6).map((anime) => {
            const selected = selectedAnime.some((item) => item.id === anime.id);
            const disabled = !selected && selectedAnime.length >= 3;
            const poster = anime.coverImage.large || anime.coverImage.extraLarge;

            return (
              <button
                key={anime.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleSelectedAnime(anime)}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-45",
                  selected
                    ? "border-ember bg-ember/12"
                    : "border-white/12 bg-white/7 hover:bg-white/10"
                )}
              >
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-panel">
                  {poster ? (
                    <Image
                      src={poster}
                      alt={`${animeTitle(anime.title)} poster`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">
                      {animeTitle(anime.title)}
                    </h3>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-ember" aria-hidden="true" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-white/48">
                    {anime.episodes ? `${anime.episodes} episodes` : "Episodes TBA"}
                    {anime.averageScore ? ` - ${anime.averageScore}%` : ""}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/54">
                    {anime.genres.slice(0, 3).join(", ")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {message ? <p className="text-sm font-semibold text-aqua">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-100">{error}</p> : null}
        </div>
        <button
          type="button"
          onClick={saveTasteProfile}
          disabled={!ready}
          className="inline-flex h-12 items-center justify-center rounded-md bg-ember px-5 text-sm font-semibold text-ink shadow-aura transition hover:bg-[#ff7a91] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving taste..." : "Save taste profile"}
        </button>
      </div>
    </main>
  );
}

type PreferenceSectionProps = {
  children: ReactNode;
  description: string;
  title: string;
};

function PreferenceSection({
  children,
  description,
  title,
}: PreferenceSectionProps) {
  return (
    <section className="rounded-lg border border-line bg-white/[0.045] p-5">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/58">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type ChipGridProps = {
  disabledItems?: string[];
  items: string[];
  muted?: boolean;
  selected: string[];
  onToggle: (item: string) => void;
};

function ChipGrid({
  disabledItems = [],
  items,
  muted,
  selected,
  onToggle,
}: ChipGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = selected.includes(item);
        const disabled = disabledItems.includes(item);

        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(item)}
            className={cn(
              "h-9 rounded-md border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-35",
              active
                ? muted
                  ? "border-aqua/35 bg-aqua/12 text-aqua"
                  : "border-ember bg-ember text-ink"
                : "border-white/12 bg-white/8 text-white/68 hover:bg-white/12 hover:text-white"
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function toggleListValue(
  setValue: Dispatch<SetStateAction<string[]>>,
  value: string
) {
  setValue((current) =>
    current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
  );
}

function buildSummary(
  favoriteGenres: string[],
  tones: string[],
  preferredLength: PreferredLength
) {
  const lengthLabel =
    preferredLength === "short"
      ? "shorter watches"
      : preferredLength === "long"
        ? "longer stories"
        : "medium-length series";

  return `Likes ${favoriteGenres.slice(0, 3).join(", ")} with ${tones
    .slice(0, 3)
    .join(", ")} tones and prefers ${lengthLabel}.`;
}
