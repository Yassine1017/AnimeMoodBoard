# Anime Moodboard

Anime Moodboard is a polished Next.js starter app for spoiler-free anime recommendations. Users enter the kind of anime they are in the mood for, and the app turns that mood into rule-based filters backed by live AniList GraphQL data.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- shadcn-style reusable UI primitives
- AniList GraphQL API
- Supabase-ready client structure for auth and saved anime
- OpenAI-ready recommendation engine placeholder

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

## Supabase Setup Later

The app includes `lib/supabase/client.ts`, `supabase/schema.sql`, and profile/save UI placeholders. For a production pass:

- Create a Supabase project.
- Run `supabase/schema.sql` in the Supabase SQL Editor.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Enable anonymous sign-ins in Supabase Authentication if you want one-click saving before building a full login screen.
- Add auth helpers for server/client sessions.
- Gate profile persistence behind authenticated user IDs.

## OpenAI Setup Later

The `/api/recommend` route currently uses rule-based mood filters. `lib/openai/recommendation-engine.ts` is structured for a future AI layer.

For a production pass:

- Set `OPENAI_API_KEY` server-side only.
- Keep recommendation calls inside API routes or server actions.
- Send AniList candidates plus user taste signals to the model.
- Require spoiler-free JSON output with titles, IDs, and concise reasons.

## Scripts

```bash
npm run lint
npm run build
```

## Core Routes

- `/` - Mood search home screen
- `/recommendations?mood=cozy%20slice%20of%20life` - Recommendation grid
- `/anime/[id]` - Anime detail page
- `/profile` - Authenticated profile placeholder
- `/api/anilist/search?q=naruto` - AniList search API
- `/api/recommend?mood=dark%20thriller` - Recommendation API
