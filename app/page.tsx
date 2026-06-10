import { AnimeGrid } from "@/components/anime-grid";
import { ContinueWatching } from "@/components/continue-watching";
import { HomeDiscovery } from "@/components/home-discovery";
import { MoodSearch } from "@/components/mood-search";
import { getRecommendations } from "@/lib/recommendations";

export default async function Home() {
  const initialResults = await getRecommendations("short and visually beautiful");

  return (
    <main>
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-white sm:text-6xl">
              Find anime for the exact mood you are chasing.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/68 sm:text-lg">
              Type a feeling, trope, pace, or vibe. Anime Moodboard turns it
              into spoiler-free picks from AniList.
            </p>
          </div>
          <div className="mt-9">
            <MoodSearch autoFocus />
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
                  Tonight&apos;s board
                </h2>
                <p className="mt-2 text-sm text-white/56">
                  Live picks for short, beautiful anime.
                </p>
              </div>
            </div>
            <AnimeGrid
              results={initialResults.results.slice(0, 4)}
              compact
              mood={initialResults.mood}
            />
          </div>
        </div>
      </section>

      <ContinueWatching />
      <HomeDiscovery />
    </main>
  );
}
