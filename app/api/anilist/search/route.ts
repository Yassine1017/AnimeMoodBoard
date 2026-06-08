import { NextResponse } from "next/server";

import { searchAnime } from "@/lib/anilist";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing q search parameter." },
      { status: 400 }
    );
  }

  try {
    const anime = await searchAnime(query);
    return NextResponse.json({ results: anime });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to search AniList.",
      },
      { status: 502 }
    );
  }
}
