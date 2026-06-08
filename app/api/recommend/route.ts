import { NextResponse } from "next/server";

import { getRecommendations } from "@/lib/recommendations";

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
    const recommendation = await getRecommendations(mood);
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
