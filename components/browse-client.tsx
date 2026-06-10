"use client";

import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";

import { AnimeGrid } from "@/components/anime-grid";
import { EmptyState } from "@/components/empty-state";
import type { Anime, BrowseSort, RecommendationResult } from "@/types/anime";

type BrowseForm = {
  query: string;
  genre: string;
  year: string;
  maxEpisodes: string;
  minScore: string;
  sort: BrowseSort;
};

type BrowsePayload = {
  results: Anime[];
  error?: string;
};

const genreOptions = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

const sortOptions: Array<{ label: string; value: BrowseSort }> = [
  { label: "Popularity", value: "POPULARITY_DESC" },
  { label: "Score", value: "SCORE_DESC" },
  { label: "Latest", value: "START_DATE_DESC" },
];

const defaultForm: BrowseForm = {
  query: "",
  genre: "",
  year: "",
  maxEpisodes: "",
  minScore: "",
  sort: "POPULARITY_DESC",
};

export function BrowseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedParams = searchParams.toString();
  const initialForm = useMemo(
    () => formFromParams(new URLSearchParams(serializedParams)),
    [serializedParams]
  );
  const [form, setForm] = useState<BrowseForm>(initialForm);
  const [results, setResults] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadResults = useCallback(
    async (nextForm: BrowseForm, updateUrl = true) => {
      setLoading(true);
      setError("");

      const params = paramsFromForm(nextForm);

      if (updateUrl) {
        router.replace(params.toString() ? `/browse?${params}` : "/browse", {
          scroll: false,
        });
      }

      try {
        const response = await fetch(`/api/browse?${params}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as BrowsePayload;

        if (!response.ok) {
          throw new Error(payload.error || "Browse results could not load.");
        }

        setResults(payload.results.map(mapBrowseResult));
      } catch (browseError) {
        setResults([]);
        setError(
          browseError instanceof Error
            ? browseError.message
            : "Browse results could not load."
        );
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    setForm(initialForm);
    void loadResults(initialForm, false);
  }, [initialForm, loadResults]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadResults(form);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-7 grid gap-5 lg:grid-cols-[minmax(0,0.64fr)_minmax(360px,0.36fr)] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Browse
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
            Find anime directly.
          </h1>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.045] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <SlidersHorizontal className="h-4 w-4 text-ember" aria-hidden="true" />
            Catalog filters
          </div>
        </div>
      </section>

      <form
        onSubmit={submitSearch}
        className="mb-7 rounded-lg border border-line bg-white/[0.045] p-3 shadow-aura"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_150px_120px_140px_130px_140px]">
          <label className="relative block">
            <span className="sr-only">Search anime title</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/58"
              aria-hidden="true"
            />
            <input
              value={form.query}
              onChange={(event) =>
                setForm((current) => ({ ...current, query: event.target.value }))
              }
              placeholder="Search by anime title"
              className="h-12 w-full rounded-md border border-white/16 bg-ink/48 pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/42 focus:border-ember focus:ring-2 focus:ring-ember/35"
            />
          </label>

          <SelectField
            label="Genre"
            value={form.genre}
            onChange={(value) => setForm((current) => ({ ...current, genre: value }))}
          >
            <option value="">Any genre</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </SelectField>

          <label>
            <span className="sr-only">Year</span>
            <input
              value={form.year}
              onChange={(event) =>
                setForm((current) => ({ ...current, year: event.target.value }))
              }
              inputMode="numeric"
              placeholder="Year"
              className="h-12 w-full rounded-md border border-white/16 bg-ink/48 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/42 focus:border-ember focus:ring-2 focus:ring-ember/35"
            />
          </label>

          <SelectField
            label="Episodes"
            value={form.maxEpisodes}
            onChange={(value) =>
              setForm((current) => ({ ...current, maxEpisodes: value }))
            }
          >
            <option value="">Any length</option>
            <option value="12">12 or less</option>
            <option value="24">24 or less</option>
            <option value="50">50 or less</option>
            <option value="100">100 or less</option>
          </SelectField>

          <SelectField
            label="Score"
            value={form.minScore}
            onChange={(value) =>
              setForm((current) => ({ ...current, minScore: value }))
            }
          >
            <option value="">Any score</option>
            <option value="60">60%+</option>
            <option value="70">70%+</option>
            <option value="80">80%+</option>
            <option value="90">90%+</option>
          </SelectField>

          <SelectField
            label="Sort"
            value={form.sort}
            onChange={(value) =>
              setForm((current) => ({ ...current, sort: value as BrowseSort }))
            }
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setForm(defaultForm);
              void loadResults(defaultForm);
            }}
            className="h-10 rounded-md border border-white/12 bg-white/8 px-4 text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink"
          >
            Reset
          </button>
          <button
            type="submit"
            className="h-10 rounded-md bg-ember px-5 text-sm font-semibold text-ink shadow-aura transition hover:bg-[#ff7a91] focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink"
          >
            Search
          </button>
        </div>
      </form>

      {loading ? (
        <BrowseSkeleton />
      ) : error ? (
        <EmptyState title="Browse is unavailable" description={error} />
      ) : results.length ? (
        <AnimeGrid
          results={results}
          mood={buildResultsLabel(form)}
          showOpenAction
        />
      ) : (
        <EmptyState
          title="No anime found"
          description="Try fewer filters or a broader title search."
        />
      )}
    </main>
  );
}

type SelectFieldProps = {
  children: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function SelectField({ children, label, value, onChange }: SelectFieldProps) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-md border border-white/16 bg-ink/48 px-3 text-sm font-semibold text-white outline-none transition focus:border-ember focus:ring-2 focus:ring-ember/35"
      >
        {children}
      </select>
    </label>
  );
}

function BrowseSkeleton() {
  return (
    <div>
      <p className="mb-4 text-sm font-medium text-white/48">
        Searching AniList
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-line bg-white/[0.045]"
          >
            <div className="aspect-[2/3] animate-pulse bg-white/8" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-white/8" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-white/8" />
              <div className="h-16 animate-pulse rounded bg-white/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formFromParams(params: URLSearchParams): BrowseForm {
  return {
    query: params.get("q") ?? "",
    genre: params.get("genre") ?? "",
    year: params.get("year") ?? "",
    maxEpisodes: params.get("maxEpisodes") ?? "",
    minScore: params.get("minScore") ?? "",
    sort: parseSort(params.get("sort")),
  };
}

function paramsFromForm(form: BrowseForm) {
  const params = new URLSearchParams();

  if (form.query.trim()) {
    params.set("q", form.query.trim());
  }

  if (form.genre) {
    params.set("genre", form.genre);
  }

  if (validNumber(form.year)) {
    params.set("year", form.year);
  }

  if (validNumber(form.maxEpisodes)) {
    params.set("maxEpisodes", form.maxEpisodes);
  }

  if (validNumber(form.minScore)) {
    params.set("minScore", form.minScore);
  }

  if (form.sort !== defaultForm.sort) {
    params.set("sort", form.sort);
  }

  return params;
}

function mapBrowseResult(anime: Anime): RecommendationResult {
  return {
    anime,
    matchedFilters: [],
    reason: "",
  };
}

function buildResultsLabel(form: BrowseForm) {
  const active = [
    form.query.trim() ? `"${form.query.trim()}"` : "all anime",
    form.genre,
    form.year,
    form.maxEpisodes ? `${form.maxEpisodes} episodes or less` : "",
    form.minScore ? `${form.minScore}%+` : "",
  ].filter(Boolean);

  return active.join(" · ");
}

function parseSort(value: string | null): BrowseSort {
  return sortOptions.some((option) => option.value === value)
    ? (value as BrowseSort)
    : "POPULARITY_DESC";
}

function validNumber(value: string) {
  return /^\d+$/.test(value);
}
