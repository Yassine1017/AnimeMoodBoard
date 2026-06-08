import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { SaveButton } from "@/components/save-button";
import { animeTitle } from "@/lib/format";
import type { RecommendationResult } from "@/types/anime";

type AnimeCardProps = {
  result: RecommendationResult;
  compact?: boolean;
};

export function AnimeCard({ result, compact }: AnimeCardProps) {
  const anime = result.anime;
  const title = animeTitle(anime.title);
  const poster = anime.coverImage.extraLarge || anime.coverImage.large || "";

  return (
    <article className="group overflow-hidden rounded-lg border border-line bg-white/[0.045] transition hover:-translate-y-1 hover:border-white/22 hover:bg-white/[0.065]">
      <Link
        href={`/anime/${anime.id}`}
        className="relative block aspect-[2/3] overflow-hidden bg-panel"
      >
        {poster ? (
          <Image
            src={poster}
            alt={`${title} poster`}
            fill
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
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/anime/${anime.id}`} className="min-w-0">
            <h2 className="line-clamp-2 text-base font-semibold leading-6 text-white transition group-hover:text-ember">
              {title}
            </h2>
          </Link>
          <SaveButton animeId={anime.id} compact />
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
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/64">
          {result.reason}
        </p>
      </div>
    </article>
  );
}
