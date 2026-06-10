-- Anime Moodboard starter schema for Supabase.
-- Run this in the Supabase SQL Editor after creating a project.

create table if not exists public.anime_cache (
  anilist_id integer primary key,
  title_romaji text,
  title_english text,
  title_native text,
  poster_url text,
  banner_url text,
  average_score integer,
  episodes integer,
  genres text[] not null default '{}',
  tags jsonb not null default '[]'::jsonb,
  season text,
  season_year integer,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_anime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anilist_id integer not null references public.anime_cache(anilist_id) on delete cascade,
  status text not null default 'saved'
    check (status in ('saved', 'watching', 'completed', 'dropped')),
  progress_episode integer not null default 0
    check (progress_episode >= 0),
  last_watched_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, anilist_id)
);

create table if not exists public.anime_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anilist_id integer not null references public.anime_cache(anilist_id) on delete cascade,
  rating integer not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, anilist_id)
);

create table if not exists public.mood_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  mood_query text not null,
  filters jsonb not null default '{}'::jsonb,
  result_anilist_ids integer[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.taste_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_genres text[] not null default '{}',
  disliked_genres text[] not null default '{}',
  preferred_episode_count text,
  mood_keywords text[] not null default '{}',
  profile_summary text,
  updated_at timestamptz not null default now()
);

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

create index if not exists saved_anime_user_created_idx
  on public.saved_anime (user_id, created_at desc);

create index if not exists anime_ratings_user_updated_idx
  on public.anime_ratings (user_id, updated_at desc);

create index if not exists mood_searches_user_created_idx
  on public.mood_searches (user_id, created_at desc);

create index if not exists anime_cache_genres_idx
  on public.anime_cache using gin (genres);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_saved_anime_updated_at on public.saved_anime;
create trigger set_saved_anime_updated_at
before update on public.saved_anime
for each row execute function public.set_updated_at();

drop trigger if exists set_anime_ratings_updated_at on public.anime_ratings;
create trigger set_anime_ratings_updated_at
before update on public.anime_ratings
for each row execute function public.set_updated_at();

drop trigger if exists set_taste_profiles_updated_at on public.taste_profiles;
create trigger set_taste_profiles_updated_at
before update on public.taste_profiles
for each row execute function public.set_updated_at();

alter table public.anime_cache enable row level security;
alter table public.saved_anime enable row level security;
alter table public.anime_ratings enable row level security;
alter table public.mood_searches enable row level security;
alter table public.taste_profiles enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.hidden_anime enable row level security;
alter table public.seen_anime enable row level security;

drop policy if exists "Anime cache is readable by everyone" on public.anime_cache;
create policy "Anime cache is readable by everyone"
on public.anime_cache for select
using (true);

drop policy if exists "Authenticated users can insert anime cache" on public.anime_cache;
create policy "Authenticated users can insert anime cache"
on public.anime_cache for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update anime cache" on public.anime_cache;
create policy "Authenticated users can update anime cache"
on public.anime_cache for update
to authenticated
using (true)
with check (true);

drop policy if exists "Users can read their saved anime" on public.saved_anime;
create policy "Users can read their saved anime"
on public.saved_anime for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their saved anime" on public.saved_anime;
create policy "Users can insert their saved anime"
on public.saved_anime for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their saved anime" on public.saved_anime;
create policy "Users can update their saved anime"
on public.saved_anime for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their saved anime" on public.saved_anime;
create policy "Users can delete their saved anime"
on public.saved_anime for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their ratings" on public.anime_ratings;
create policy "Users can read their ratings"
on public.anime_ratings for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their ratings" on public.anime_ratings;
create policy "Users can insert their ratings"
on public.anime_ratings for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their ratings" on public.anime_ratings;
create policy "Users can update their ratings"
on public.anime_ratings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their ratings" on public.anime_ratings;
create policy "Users can delete their ratings"
on public.anime_ratings for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their mood searches" on public.mood_searches;
create policy "Users can read their mood searches"
on public.mood_searches for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their mood searches" on public.mood_searches;
create policy "Users can insert their mood searches"
on public.mood_searches for insert
with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can read their taste profile" on public.taste_profiles;
create policy "Users can read their taste profile"
on public.taste_profiles for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their taste profile" on public.taste_profiles;
create policy "Users can insert their taste profile"
on public.taste_profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their taste profile" on public.taste_profiles;
create policy "Users can update their taste profile"
on public.taste_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
