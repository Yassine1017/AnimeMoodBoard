import { NextResponse } from "next/server";

import { createUserSupabaseClient } from "@/lib/supabase/user-server";

type FeedbackAction =
  | "more_like_this"
  | "less_dark"
  | "shorter"
  | "more_emotional";

type FeedbackBody = {
  action?: FeedbackAction;
  mood?: string;
  anchorAnime?: {
    id?: number;
    title?: string;
    genres?: string[];
  };
};

const allowedActions = new Set<FeedbackAction>([
  "more_like_this",
  "less_dark",
  "shorter",
  "more_emotional",
]);

export async function POST(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  const supabase = createUserSupabaseClient(accessToken);

  if (!accessToken || !supabase) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  let body: FeedbackBody;

  try {
    body = (await request.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action;
  const mood = body.mood?.trim();

  if (!action || !allowedActions.has(action) || !mood) {
    return NextResponse.json(
      { error: "Feedback action and mood are required." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("recommendation_feedback").insert({
    user_id: user.id,
    mood_query: mood,
    action,
    anchor_anilist_id: sanitizeId(body.anchorAnime?.id),
    anchor_title: body.anchorAnime?.title?.slice(0, 240) ?? null,
    anchor_genres: (body.anchorAnime?.genres ?? []).slice(0, 6),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function sanitizeId(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function getBearerToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = header.slice("Bearer ".length).trim();
  return token || undefined;
}
