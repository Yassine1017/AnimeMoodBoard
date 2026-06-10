"use client";

import { useRouter } from "next/navigation";
import { Clock3, Heart, RefreshCw, Sparkles, SunMedium } from "lucide-react";

import { animeTitle } from "@/lib/format";
import type { RecommendationResult } from "@/types/anime";

type RecommendationFeedbackProps = {
  mood: string;
  topResult?: RecommendationResult;
};

const darkWords = /\b(dark|psychological|thriller|horror|violent|bleak)\b/gi;

export function RecommendationFeedback({
  mood,
  topResult,
}: RecommendationFeedbackProps) {
  const router = useRouter();
  const topAnime = topResult?.anime;

  function refine(nextMood: string) {
    router.push(`/recommendations?mood=${encodeURIComponent(cleanMood(nextMood))}`);
  }

  const moreLikeThis = topAnime
    ? `${animeTitle(topAnime.title)} ${topAnime.genres.slice(0, 2).join(" ")} similar anime`
    : `${mood} similar anime`;
  const lessDark = `${mood.replace(darkWords, "").trim()} hopeful lighter tone`;
  const shorter = `${mood} short under 24 episodes`;
  const moreEmotional = `${mood} emotional character driven`;

  return (
    <div className="mb-6 rounded-lg border border-line bg-white/[0.045] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-aqua" aria-hidden="true" />
          Refine picks
        </div>
        <div className="flex flex-wrap gap-2">
          <FeedbackButton
            icon={RefreshCw}
            label="More like this"
            onClick={() => refine(moreLikeThis)}
          />
          <FeedbackButton
            icon={SunMedium}
            label="Less dark"
            onClick={() => refine(lessDark)}
          />
          <FeedbackButton
            icon={Clock3}
            label="Shorter"
            onClick={() => refine(shorter)}
          />
          <FeedbackButton
            icon={Heart}
            label="More emotional"
            onClick={() => refine(moreEmotional)}
          />
        </div>
      </div>
    </div>
  );
}

type FeedbackButtonProps = {
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
};

function FeedbackButton({ icon: Icon, label, onClick }: FeedbackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function cleanMood(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
