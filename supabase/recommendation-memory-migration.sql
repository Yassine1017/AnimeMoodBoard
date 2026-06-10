-- Recommendation memory for Anime Moodboard.
-- Run this once in Supabase SQL Editor for an existing project.

create table if not exists public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood_query text not null,
  action text not null
    check (action in ('more_like_this', 'less_dark', 'shorter', 'more_emotional')),
  anchor_anilist_id integer,
  anchor_title text,
  anchor_genres text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.hidden_anime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anilist_id integer not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, anilist_id)
);

create table if not exists public.seen_anime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anilist_id integer not null,
  source text not null default 'recommendations',
  seen_count integer not null default 1 check (seen_count >= 1),
  last_seen_at timestamptz not null default now(),
  unique (user_id, anilist_id)
);

create index if not exists recommendation_feedback_user_created_idx
  on public.recommendation_feedback (user_id, created_at desc);

create index if not exists hidden_anime_user_created_idx
  on public.hidden_anime (user_id, created_at desc);

create index if not exists hidden_anime_user_anilist_idx
  on public.hidden_anime (user_id, anilist_id);

create index if not exists seen_anime_user_seen_idx
  on public.seen_anime (user_id, last_seen_at desc);

create index if not exists seen_anime_user_anilist_idx
  on public.seen_anime (user_id, anilist_id);

alter table public.recommendation_feedback enable row level security;
alter table public.hidden_anime enable row level security;
alter table public.seen_anime enable row level security;

drop policy if exists "Users can read their recommendation feedback" on public.recommendation_feedback;
create policy "Users can read their recommendation feedback"
on public.recommendation_feedback for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their recommendation feedback" on public.recommendation_feedback;
create policy "Users can insert their recommendation feedback"
on public.recommendation_feedback for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can read their hidden anime" on public.hidden_anime;
create policy "Users can read their hidden anime"
on public.hidden_anime for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their hidden anime" on public.hidden_anime;
create policy "Users can insert their hidden anime"
on public.hidden_anime for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their hidden anime" on public.hidden_anime;
create policy "Users can update their hidden anime"
on public.hidden_anime for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their hidden anime" on public.hidden_anime;
create policy "Users can delete their hidden anime"
on public.hidden_anime for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their seen anime" on public.seen_anime;
create policy "Users can read their seen anime"
on public.seen_anime for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their seen anime" on public.seen_anime;
create policy "Users can insert their seen anime"
on public.seen_anime for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their seen anime" on public.seen_anime;
create policy "Users can update their seen anime"
on public.seen_anime for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
