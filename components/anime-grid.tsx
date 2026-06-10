import { AnimeCard } from "@/components/anime-card";
import type { RecommendationResult } from "@/types/anime";

type AnimeGridProps = {
  results: RecommendationResult[];
  compact?: boolean;
  mood?: string;
  showHideAction?: boolean;
  showOpenAction?: boolean;
};

export function AnimeGrid({
  results,
  compact,
  mood,
  showHideAction,
  showOpenAction,
}: AnimeGridProps) {
  return (
    <div>
      {mood ? (
        <p className="mb-4 text-sm text-white/48">
          {results.length} spoiler-free picks for &ldquo;{mood}&rdquo;
        </p>
      ) : null}
      <div
        className={
          compact
            ? "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
            : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        }
      >
        {results.map((result, index) => (
          <AnimeCard
            key={result.anime.id}
            result={result}
            compact={compact}
            mood={mood}
            priority={!compact && index === 0}
            showHideAction={showHideAction}
            showOpenAction={showOpenAction}
          />
        ))}
      </div>
    </div>
  );
}
