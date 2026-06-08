"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";

import { cn } from "@/lib/utils";

type SaveButtonProps = {
  animeId: number;
  compact?: boolean;
};

export function SaveButton({ animeId, compact }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Saved anime ${animeId}` : `Save anime ${animeId}`}
      onClick={() => setSaved((current) => !current)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/8 text-sm font-semibold text-white transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink",
        saved && "border-ember bg-ember text-ink hover:bg-[#ff7a91]",
        compact ? "h-9 w-9" : "h-11 gap-2 px-4"
      )}
    >
      <Bookmark
        className={cn("h-4 w-4", saved && "fill-current")}
        aria-hidden="true"
      />
      {compact ? null : saved ? "Saved" : "Save"}
    </button>
  );
}
