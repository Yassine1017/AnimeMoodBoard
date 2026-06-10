import { NextResponse } from "next/server";

import { browseAnime } from "@/lib/anilist";
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
    perPage: 24,
  };

  try {
    const anime = await browseAnime(filters);

    return NextResponse.json({
      results: anime,
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
