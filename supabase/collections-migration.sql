-- Anime Moodboard collections and "less like this" feedback.
-- Run this once in Supabase SQL Editor for an existing project.

alter table public.recommendation_feedback
  drop constraint if exists recommendation_feedback_action_check;

alter table public.recommendation_feedback
  add constraint recommendation_feedback_action_check
  check (action in (
    'more_like_this',
    'less_like_this',
    'less_dark',
    'shorter',
    'more_emotional'
  ));

create table if not exists public.anime_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anime_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.anime_collections(id) on delete cascade,
  anilist_id integer not null references public.anime_cache(anilist_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, anilist_id)
);

create index if not exists anime_collections_user_created_idx
  on public.anime_collections (user_id, created_at desc);

create index if not exists anime_collection_items_collection_idx
  on public.anime_collection_items (collection_id, created_at desc);

drop trigger if exists set_anime_collections_updated_at on public.anime_collections;
create trigger set_anime_collections_updated_at
before update on public.anime_collections
for each row execute function public.set_updated_at();

alter table public.anime_collections enable row level security;
alter table public.anime_collection_items enable row level security;

drop policy if exists "Users can read their collections" on public.anime_collections;
create policy "Users can read their collections"
on public.anime_collections for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their collections" on public.anime_collections;
create policy "Users can insert their collections"
on public.anime_collections for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their collections" on public.anime_collections;
create policy "Users can update their collections"
on public.anime_collections for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their collections" on public.anime_collections;
create policy "Users can delete their collections"
on public.anime_collections for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their collection items" on public.anime_collection_items;
create policy "Users can read their collection items"
on public.anime_collection_items for select
using (
  exists (
    select 1 from public.anime_collections
    where anime_collections.id = anime_collection_items.collection_id
      and anime_collections.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert their collection items" on public.anime_collection_items;
create policy "Users can insert their collection items"
on public.anime_collection_items for insert
with check (
  exists (
    select 1 from public.anime_collections
    where anime_collections.id = anime_collection_items.collection_id
      and anime_collections.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their collection items" on public.anime_collection_items;
create policy "Users can delete their collection items"
on public.anime_collection_items for delete
using (
  exists (
    select 1 from public.anime_collections
    where anime_collections.id = anime_collection_items.collection_id
      and anime_collections.user_id = auth.uid()
  )
);
