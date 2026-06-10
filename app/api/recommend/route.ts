import { NextResponse } from "next/server";

import { getPersonalizedRecommendations } from "@/lib/recommendations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mood = searchParams.get("mood")?.trim();

  if (!mood) {
    return NextResponse.json(
      { error: "Missing mood search parameter." },
      { status: 400 }
    );
  }

  try {
    const recommendation = await getPersonalizedRecommendations(
      mood,
      getBearerToken(request.headers.get("authorization"))
    );

    return NextResponse.json(recommendation);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create recommendations.",
      },
      { status: 502 }
    );
  }
}

function getBearerToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = header.slice("Bearer ".length).trim();
  return token || undefined;
}
