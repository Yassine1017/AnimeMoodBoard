import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";

import { AnimeGrid } from "@/components/anime-grid";
import { getAiringAnime, getHomeDiscoveryRows } from "@/lib/anilist";
import { animeTitle, mapAnimeToRecommendation } from "@/lib/format";

export async function HomeDiscovery() {
  const [rows, airing] = await Promise.all([
    getHomeDiscoveryRows(),
    getAiringAnime(6),
  ]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Discover
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white">
            Browse by mood before you search.
          </h2>
        </div>
        <Link
          href="/browse"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Open full catalog
        </Link>
      </div>

      {airing.length ? (
        <section className="mb-10 rounded-lg border border-aqua/20 bg-aqua/10 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Airing now
              </h3>
              <p className="mt-1 text-sm text-white/56">
                Track ongoing shows and see the next episode signal.
              </p>
            </div>
            <Link
              href="/browse?sort=START_DATE_DESC"
              className="text-sm font-semibold text-aqua transition hover:text-white"
            >
              Browse latest
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {airing.map((anime) => (
              <Link
                key={anime.id}
                href={`/anime/${anime.id}`}
                className="rounded-md border border-white/10 bg-ink/40 p-3 transition hover:border-aqua/45 hover:bg-white/8"
              >
                <div className="flex items-start gap-3">
                  <CalendarClock
                    className="mt-0.5 h-4 w-4 shrink-0 text-aqua"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h4 className="line-clamp-1 text-sm font-semibold text-white">
                      {animeTitle(anime.title)}
                    </h4>
                    <p className="mt-1 text-xs font-medium text-white/54">
                      {formatNextEpisode(anime.nextAiringEpisode)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-10">
        {rows.map((row) => (
          <section key={row.title}>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-white">
                  {row.title}
                </h3>
                <p className="mt-1 text-sm text-white/54">{row.description}</p>
              </div>
              <Link
                href={`/recommendations?mood=${encodeURIComponent(row.mood)}`}
                className="text-sm font-semibold text-ember transition hover:text-white"
              >
                More like this
              </Link>
            </div>
            <AnimeGrid
              results={row.results.slice(0, 6).map((result) =>
                result.reason
                  ? result
                  : mapAnimeToRecommendation(result.anime, "")
              )}
              compact
              mood={row.mood}
            />
          </section>
        ))}
      </div>
    </section>
  );
}

function formatNextEpisode(
  nextAiringEpisode?: {
    episode?: number | null;
    timeUntilAiring?: number | null;
  } | null
) {
  if (!nextAiringEpisode?.episode) {
    return "New episode schedule TBA";
  }

  if (!nextAiringEpisode.timeUntilAiring) {
    return `Episode ${nextAiringEpisode.episode} is next`;
  }

  const days = Math.floor(nextAiringEpisode.timeUntilAiring / 86400);
  const hours = Math.floor((nextAiringEpisode.timeUntilAiring % 86400) / 3600);

  if (days > 0) {
    return `Episode ${nextAiringEpisode.episode} in ${days}d ${hours}h`;
  }

  return `Episode ${nextAiringEpisode.episode} in ${Math.max(hours, 1)}h`;
}
