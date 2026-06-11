import { NextResponse } from "next/server";

import { browseAnime, searchAnime } from "@/lib/anilist";
import { animeTitle } from "@/lib/format";
import type { Anime } from "@/types/anime";
import type { BrowseFilters, BrowseSort } from "@/types/anime";

const SORT_VALUES = new Set<BrowseSort>([
  "POPULARITY_DESC",
  "SCORE_DESC",
  "START_DATE_DESC",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = parseSort(searchParams.get("sort"));

  const filters: BrowseFilters = {
    query: cleanText(searchParams.get("q")),
    genre: cleanText(searchParams.get("genre")),
    year: parseNumber(searchParams.get("year"), 1940, 2100),
    maxEpisodes: parseNumber(searchParams.get("maxEpisodes"), 1, 10000),
    minScore: parseNumber(searchParams.get("minScore"), 1, 100),
    sort,
    page: parseNumber(searchParams.get("page"), 1, 500) ?? 1,
    perPage: 24,
  };

  try {
    const browseResult = await browseAnime(filters);
    const query = filters.query;
    const titleResults =
      query && filters.page === 1 ? await safeTitleSearch(query) : [];
    const results = titleResults.length
      ? mergeTitleResults(
          query!,
          titleResults,
          browseResult.results,
          filters.perPage ?? 24
        )
      : browseResult.results;

    return NextResponse.json({
      results,
      pageInfo: browseResult.pageInfo,
      filters,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to browse AniList.",
      },
      { status: 502 }
    );
  }
}

async function safeTitleSearch(query: string) {
  try {
    return await searchAnime(query);
  } catch {
    return [];
  }
}

function mergeTitleResults(
  query: string,
  titleResults: Anime[],
  browseResults: Anime[],
  limit: number
) {
  const normalizedQuery = normalizeTitle(query);
  const exactTitleResults = titleResults.filter((anime) =>
    titleValues(anime).some((title) => {
      const normalizedTitle = normalizeTitle(title);
      return (
        normalizedTitle === normalizedQuery ||
        normalizedTitle.startsWith(normalizedQuery)
      );
    })
  );
  const merged = [...exactTitleResults, ...browseResults, ...titleResults];
  const seen = new Set<number>();

  return merged.filter((anime) => {
    if (seen.has(anime.id)) {
      return false;
    }

    seen.add(anime.id);
    return true;
  }).slice(0, limit);
}

function titleValues(anime: Anime) {
  return [
    animeTitle(anime.title),
    anime.title.romaji,
    anime.title.english,
    anime.title.native,
  ].filter((title): title is string => Boolean(title));
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parseSort(value: string | null): BrowseSort {
  return value && SORT_VALUES.has(value as BrowseSort)
    ? (value as BrowseSort)
    : "POPULARITY_DESC";
}

function parseNumber(
  value: string | null,
  min: number,
  max: number
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return undefined;
  }

  return parsed;
}
