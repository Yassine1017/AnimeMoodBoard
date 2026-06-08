"use client";

import { cn } from "@/lib/utils";

const moods = [
  "Emotional but hopeful",
  "Dark psychological thriller",
  "Short and visually beautiful",
  "Sports anime with hype moments",
  "Cozy slice of life",
];

type MoodChipsProps = {
  onSelect: (mood: string) => void;
  selected?: string;
};

export function MoodChips({ onSelect, selected }: MoodChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Example moods">
      {moods.map((mood) => (
        <button
          key={mood}
          type="button"
          onClick={() => onSelect(mood)}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink",
            selected === mood
              ? "border-ember bg-ember text-ink"
              : "border-white/12 bg-white/7 text-white/74 hover:border-white/22 hover:bg-white/11 hover:text-white"
          )}
        >
          {mood}
        </button>
      ))}
    </div>
  );
}
