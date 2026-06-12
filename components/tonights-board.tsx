import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { animeTitle } from "@/lib/format";
import type { RecommendationResult } from "@/types/anime";

type TonightsBoardProps = {
  results: RecommendationResult[];
};

export function TonightsBoard({ results }: TonightsBoardProps) {
  const picks = results.slice(0, 4);

  if (!picks.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-white/[0.045] p-4 shadow-aura">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Tonight&apos;s board
          </h2>
          <p className="mt-2 text-sm text-white/56">Live picks from AniList.</p>
        </div>
        <Link
          href="/browse"
          className="hidden text-sm font-semibold text-ember transition hover:text-white sm:inline"
        >
          Browse
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {picks.map((result) => {
          const anime = result.anime;
          const title = animeTitle(anime.title);
          const poster = anime.coverImage.extraLarge || anime.coverImage.large;

          return (
            <Link
              key={anime.id}
              href={`/anime/${anime.id}`}
              className="group relative min-h-[230px] overflow-hidden rounded-lg border border-white/10 bg-panel transition hover:-translate-y-0.5 hover:border-white/24"
            >
              {poster ? (
                <Image
                  src={poster}
                  alt={`${title} poster`}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 45vw, 260px"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/32 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-ink/72 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
                  <Star className="h-3.5 w-3.5 text-ember" aria-hidden="true" />
                  {anime.averageScore ? `${anime.averageScore}%` : "New"}
                </div>
                <h3 className="line-clamp-2 text-base font-semibold leading-5 text-white">
                  {title}
                </h3>
                <p className="mt-1 text-xs font-medium text-white/62">
                  {anime.episodes ? `${anime.episodes} episodes` : "Episodes TBA"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
