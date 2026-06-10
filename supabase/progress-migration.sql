-- Add episode progress tracking to existing Anime Moodboard projects.
-- Run this once in the Supabase SQL Editor before deploying the progress UI.

alter table public.saved_anime
  add column if not exists progress_episode integer not null default 0
    check (progress_episode >= 0),
  add column if not exists last_watched_at timestamptz;
