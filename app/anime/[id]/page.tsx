import Image from "next/image";
import { notFound } from "next/navigation";
import { Calendar, Clock, Star } from "lucide-react";

import { AnimeGrid } from "@/components/anime-grid";
import { SaveButton } from "@/components/save-button";
import { ButtonLink } from "@/components/ui/button-link";
import { getAnimeById } from "@/lib/anilist";
import { animeTitle, cleanDescription, mapAnimeToRecommendation } from "@/lib/format";
import type { Anime } from "@/types/anime";

type AnimeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AnimeDetailPage({ params }: AnimeDetailPageProps) {
  const { id } = await params;
  const anime = await getAnimeById(Number(id));

  if (!anime) {
    notFound();
  }

  const similar =
    anime.recommendations?.nodes
      ?.map((node) => node.mediaRecommendation)
      .filter((item): item is Anime => Boolean(item))
      .slice(0, 12)
      .map((item) =>
        mapAnimeToRecommendation(item, "Shares audience overlap and tone markers.")
      ) ?? [];
  const poster = anime.coverImage.extraLarge || anime.coverImage.large;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line">
        {anime.bannerImage ? (
          <Image
            src={anime.bannerImage}
            alt=""
            fill
            priority
            className="object-cover opacity-28"
            sizes="100vw"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/45 via-ink/86 to-ink" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)] lg:px-8 lg:py-16">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/15 bg-panel shadow-aura">
            {poster ? (
              <Image
                src={poster}
                alt={`${animeTitle(anime.title)} poster`}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 70vw, 220px"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col justify-end">
            <div className="flex flex-wrap gap-2">
              {anime.genres.slice(0, 5).map((genre) => (
                <span
                  key={genre}
                  className="rounded-md border border-white/12 bg-white/8 px-2.5 py-1 text-xs font-medium text-white/78"
                >
                  {genre}
                </span>
              ))}
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-6xl">
              {animeTitle(anime.title)}
            </h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/68">
              <span className="inline-flex items-center gap-2">
                <Star className="h-4 w-4 text-ember" />
                {anime.averageScore ? `${anime.averageScore}%` : "Unscored"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-aqua" />
                {anime.episodes ? `${anime.episodes} episodes` : "Episodes TBA"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-white/58" />
                {[anime.season, anime.seasonYear].filter(Boolean).join(" ") ||
                  "Season TBA"}
              </span>
            </div>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/72">
              {cleanDescription(anime.description) ||
                "No synopsis is available from AniList yet."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <SaveButton animeId={anime.id} />
              <ButtonLink href="/profile" variant="secondary">
                Rate later
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(280px,0.28fr)]">
          <div>
            <h2 className="text-xl font-semibold text-white">Tags</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {anime.tags
                .filter((tag) => !tag.isMediaSpoiler)
                .slice(0, 16)
                .map((tag) => (
                  <span
                    key={tag.name}
                    className="rounded-md bg-white/7 px-2.5 py-1.5 text-xs font-medium text-white/68"
                  >
                    {tag.name}
                  </span>
                ))}
            </div>
          </div>
          <aside className="rounded-lg border border-line bg-white/[0.045] p-5">
            <h2 className="text-base font-semibold text-white">Save status</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">
              Auth, saved anime, and ratings are scaffolded for Supabase.
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <h2 className="mb-5 text-2xl font-semibold text-white">Similar picks</h2>
        <AnimeGrid results={similar} mood="similar anime" compact />
      </section>
    </main>
  );
}
