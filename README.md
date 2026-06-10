# Anime Moodboard

Anime Moodboard is a polished Next.js starter app for spoiler-free anime recommendations. Users enter the kind of anime they are in the mood for, and the app turns that mood into live AniList picks ranked by mood, saved anime, ratings, and optional OpenAI refinement.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- shadcn-style reusable UI primitives
- AniList GraphQL API
- Supabase auth, saved anime, ratings, and taste profile signals
- OpenAI-ready recommendation reranker with a rule-based fallback

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill values as needed.

```bash
ANILIST_GRAPHQL_ENDPOINT=https://graphql.anilist.co
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

AniList public reads do not require an API key.

## Supabase Setup

The app includes `lib/supabase/client.ts`, `supabase/schema.sql`, saved anime, ratings, and profile UI.

- Create a Supabase project.
- Run `supabase/schema.sql` in the Supabase SQL Editor.
- If your project already exists, run `supabase/progress-migration.sql` to add episode progress tracking.
- If your project already exists, run `supabase/recommendation-memory-migration.sql` to add feedback, hidden anime, and seen anime memory.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Enable anonymous sign-ins in Supabase Authentication if you want one-click saving before building a full login screen.
- Enable email magic links in Authentication.
- Enable Google in Authentication providers and add your local and production redirect URLs.
- Enable manual identity linking if you want guest users to link Google from the Profile page.
- Add redirect URLs such as `http://127.0.0.1:3000/profile` and your production `/profile` URL.

## Recommendation Engine

The `/api/recommend` route works in three layers:

- Rule-based mood filters convert words like `dark`, `short`, `sports`, and `cozy` into AniList genres/tags.
- Taste-aware ranking reads the signed-in or guest Supabase profile and boosts matches based on saved genres, ratings, completed shows, and preferred episode length.
- Recommendation memory stores feedback clicks, hidden anime, and seen anime so repeated searches can avoid stale picks and respond to preferences like shorter or more emotional.
- Optional OpenAI reranking uses the server-only `OPENAI_API_KEY` to choose and explain the strongest spoiler-free picks from AniList candidates.

OpenAI is not required. Without `OPENAI_API_KEY`, recommendations fall back to the taste-aware local ranker.

For AI mode:

- Set `OPENAI_API_KEY` server-side only.
- Optionally set `OPENAI_MODEL`.
- Keep recommendation calls inside API routes or server actions.
- Send only AniList candidates and compact taste signals to the model.
- Require spoiler-free structured JSON output with AniList IDs and concise reasons.

## Scripts

```bash
npm run lint
npm run build
```

## Core Routes

- `/` - Mood search home screen
- `/browse` - Direct anime title search, filters, and sort controls
- `/recommendations?mood=cozy%20slice%20of%20life` - Recommendation grid
- `/anime/[id]` - Anime detail page
- `/library` - Saved anime, watching, completed, ratings, and progress management
- `/profile` - Account, auth, stats, and taste profile overview
- `/api/anilist/search?q=naruto` - AniList search API
- `/api/browse?q=naruto&genre=Action&sort=SCORE_DESC` - Filtered AniList browse API
- `/api/recommend?mood=dark%20thriller` - Personalized recommendation API
