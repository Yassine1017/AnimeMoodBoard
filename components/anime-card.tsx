import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { HideAnimeButton } from "@/components/hide-anime-button";
import { SaveButton } from "@/components/save-button";
import { animeTitle } from "@/lib/format";
import type { RecommendationResult } from "@/types/anime";

type AnimeCardProps = {
  result: RecommendationResult;
  compact?: boolean;
  priority?: boolean;
  showHideAction?: boolean;
  showOpenAction?: boolean;
};

export function AnimeCard({
  result,
  compact,
  priority,
  showHideAction,
  showOpenAction,
}: AnimeCardProps) {
  const anime = result.anime;
  const title = animeTitle(anime.title);
  const poster = anime.coverImage.extraLarge || anime.coverImage.large || "";
  const detailHref = `/anime/${anime.id}`;

  return (
    <article
      data-anime-id={anime.id}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white/[0.045] transition hover:-translate-y-1 hover:border-white/22 hover:bg-white/[0.065]"
    >
      <Link
        href={detailHref}
        className="relative block aspect-[2/3] overflow-hidden bg-panel"
      >
        {poster ? (
          <Image
            src={poster}
            alt={`${title} poster`}
            fill
            priority={priority}
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes={
              compact
                ? "(max-width: 768px) 50vw, 260px"
                : "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 260px"
            }
          />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-white/48">
            Poster unavailable
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/92 via-ink/28 to-transparent p-3">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-ink/72 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            <Star className="h-3.5 w-3.5 text-ember" aria-hidden="true" />
            {anime.averageScore ? `${anime.averageScore}%` : "New"}
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-3">
          <Link href={detailHref} className="min-w-0">
            <h2 className="line-clamp-2 text-base font-semibold leading-6 text-white transition group-hover:text-ember">
              {title}
            </h2>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {showHideAction ? <HideAnimeButton anime={anime} /> : null}
            <SaveButton anime={anime} compact />
          </div>
        </div>
        <p className="mt-1 text-sm text-white/52">
          {anime.episodes ? `${anime.episodes} episodes` : "Episodes TBA"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {anime.genres.slice(0, compact ? 2 : 3).map((genre) => (
            <span
              key={genre}
              className="rounded-md bg-white/8 px-2 py-1 text-xs font-medium text-white/62"
            >
              {genre}
            </span>
          ))}
        </div>
        {result.reason ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/64">
            {result.reason}
          </p>
        ) : null}
        {showOpenAction ? (
          <div className="mt-auto pt-4">
            <a
              href={detailHref}
              aria-label={`Open ${title}`}
              title={`Open ${title}`}
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-white/12 bg-white/8 text-sm font-semibold text-white/78 transition hover:bg-white/12 hover:text-white focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink"
            >
              Open anime
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}
