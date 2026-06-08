"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { MoodChips } from "@/components/mood-chips";

type MoodSearchProps = {
  defaultValue?: string;
  autoFocus?: boolean;
};

export function MoodSearch({ defaultValue = "", autoFocus }: MoodSearchProps) {
  const [query, setQuery] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(nextQuery = query) {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      return;
    }

    startTransition(() => {
      router.push(`/recommendations?mood=${encodeURIComponent(trimmed)}`);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return (
    <div className="rounded-lg border border-line bg-white/[0.055] p-3 shadow-aura backdrop-blur">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="mood-search">
          What kind of anime are you in the mood for?
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/42"
            aria-hidden="true"
          />
          <textarea
            id="mood-search"
            value={query}
            autoFocus={autoFocus}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="What kind of anime are you in the mood for?"
            rows={2}
            className="h-24 w-full resize-none rounded-md border border-white/12 bg-ink/64 py-4 pl-12 pr-4 text-base font-medium leading-6 text-white outline-none transition placeholder:text-white/38 focus:border-ember focus:ring-2 focus:ring-ember/35 sm:h-14 sm:overflow-hidden sm:whitespace-nowrap"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          className="h-14 rounded-md bg-ember px-6 text-sm font-semibold text-ink shadow-aura transition hover:bg-[#ff7a91] focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Finding..." : "Get picks"}
        </button>
      </form>
      <div className="mt-3">
        <MoodChips
          selected={query}
          onSelect={(mood) => {
            setQuery(mood);
            submit(mood);
          }}
        />
      </div>
    </div>
  );
}
