import { Bookmark, Radar, Star } from "lucide-react";

import { EmptyState } from "@/components/empty-state";

const profileCards = [
  {
    title: "Saved anime",
    value: "0",
    icon: Bookmark,
    description: "Your watchlist will appear here after Supabase auth is connected.",
  },
  {
    title: "Ratings",
    value: "0",
    icon: Star,
    description: "Rate completed shows to improve future recommendations.",
  },
  {
    title: "Taste profile",
    value: "Warm start",
    icon: Radar,
    description: "Mood history, genres, and ratings will shape your taste graph.",
  },
];

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.62fr)_minmax(300px,0.38fr)] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Profile
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Your anime taste, ready for auth.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            This is the authenticated profile shell for saved anime, ratings,
            and future taste learning.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.045] p-5">
          <p className="text-sm font-medium text-white/58">Signed in as</p>
          <p className="mt-2 text-lg font-semibold text-white">Demo viewer</p>
          <p className="mt-2 text-sm text-white/54">Supabase session pending</p>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {profileCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-lg border border-line bg-white/[0.045] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium text-white/68">{card.title}</h2>
                <Icon className="h-5 w-5 text-ember" aria-hidden="true" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
              <p className="mt-3 text-sm leading-6 text-white/56">
                {card.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <EmptyState
          title="No saved anime yet"
          description="Save buttons are in place. Connect Supabase to persist this list."
        />
        <EmptyState
          title="No ratings yet"
          description="Rating controls are ready to become personalized taste signals."
        />
      </section>
    </main>
  );
}
