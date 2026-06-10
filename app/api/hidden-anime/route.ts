import { NextResponse } from "next/server";

import { createUserSupabaseClient } from "@/lib/supabase/user-server";

type HiddenAnimeBody = {
  anilistId?: number;
  reason?: string;
};

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

  let body: HiddenAnimeBody;

  try {
    body = (await request.json()) as HiddenAnimeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Number.isInteger(body.anilistId)) {
    return NextResponse.json({ error: "Anime id is required." }, { status: 400 });
  }

  const anilistId = body.anilistId as number;
  const now = new Date().toISOString();
  const { error } = await supabase.from("hidden_anime").upsert(
    {
      user_id: user.id,
      anilist_id: anilistId,
      reason: body.reason?.slice(0, 80) ?? "not_interested",
      created_at: now,
    },
    { onConflict: "user_id,anilist_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("seen_anime").upsert(
    {
      user_id: user.id,
      anilist_id: anilistId,
      source: "hidden",
      last_seen_at: now,
    },
    { onConflict: "user_id,anilist_id" }
  );

  return NextResponse.json({ ok: true });
}

function getBearerToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = header.slice("Bearer ".length).trim();
  return token || undefined;
}
