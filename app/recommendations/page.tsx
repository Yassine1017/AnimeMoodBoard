import { EmptyState } from "@/components/empty-state";
import { AnimeGrid } from "@/components/anime-grid";
import { MoodSearch } from "@/components/mood-search";
import { getRecommendations } from "@/lib/recommendations";

type RecommendationsPageProps = {
  searchParams: Promise<{
    mood?: string;
  }>;
};

export default async function RecommendationsPage({
  searchParams,
}: RecommendationsPageProps) {
  const params = await searchParams;
  const mood = params.mood?.trim() || "cozy slice of life";

  try {
    const recommendation = await getRecommendations(mood);

    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(360px,0.6fr)] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
              Recommendations
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              {mood}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
              Spoiler-free picks matched with simple mood filters. Save and AI
              refinement are ready for the next backend pass.
            </p>
          </div>
          <MoodSearch defaultValue={mood} />
        </section>

        {recommendation.results.length > 0 ? (
          <AnimeGrid results={recommendation.results} mood={recommendation.mood} />
        ) : (
          <EmptyState
            title="No matches yet"
            description="Try a broader mood like emotional, cozy, dark thriller, sports, or short."
          />
        )}
      </main>
    );
  } catch (error) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <MoodSearch defaultValue={mood} />
        <div className="mt-8">
          <EmptyState
            title="AniList is taking a breather"
            description={
              error instanceof Error
                ? error.message
                : "Recommendations could not be loaded right now."
            }
          />
        </div>
      </main>
    );
  }
}
