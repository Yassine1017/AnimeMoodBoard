"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FolderHeart, Plus } from "lucide-react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type CollectionAnimeOption = {
  anilistId: number;
  title: string;
};

type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  items:
    | Array<{
        anilist_id: number | null;
      }>
    | null;
};

type AnimeCollection = {
  description: string | null;
  id: string;
  itemCount: number;
  name: string;
};

const collectionPresets = [
  {
    name: "Rainy night anime",
    description: "Quiet, atmospheric shows for slower evenings.",
  },
  {
    name: "Watch with friends",
    description: "Easy picks for group reactions and shared hype.",
  },
  {
    name: "Need motivation",
    description: "Energetic shows for momentum and comeback arcs.",
  },
  {
    name: "Comfort rewatches",
    description: "Reliable favorites for low-pressure viewing.",
  },
];

export function CollectionsPanel({
  savedAnime,
}: {
  savedAnime: CollectionAnimeOption[];
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [collections, setCollections] = useState<AnimeCollection[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedAnime, setSelectedAnime] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function loadCollections() {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setCollections([]);
      setLoading(false);
      return;
    }

    const { data, error: collectionsError } = await supabase
      .from("anime_collections")
      .select(
        `
          id,
          name,
          description,
          items:anime_collection_items (
            anilist_id
          )
        `
      )
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (collectionsError) {
      setError(
        collectionsError.message.includes("anime_collections")
          ? "Run the collections migration in Supabase to enable mood boards."
          : collectionsError.message
      );
      setCollections([]);
    } else {
      setCollections(
        ((data ?? []) as CollectionRow[]).map((collection) => ({
          description: collection.description,
          id: collection.id,
          itemCount: collection.items?.length ?? 0,
          name: collection.name,
        }))
      );
    }

    setLoading(false);
  }

  async function createCollection(
    name: string,
    description = "A custom anime mood board."
  ) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    setMessage("");
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setError("Continue as guest or sign in before creating collections.");
      return;
    }

    const { error: createError } = await supabase
      .from("anime_collections")
      .insert({
        user_id: session.user.id,
        name: trimmedName,
        description,
      });

    if (createError) {
      setError(
        createError.message.includes("anime_collections")
          ? "Run the collections migration in Supabase to enable mood boards."
          : createError.message
      );
      return;
    }

    setNewName("");
    setMessage("Collection created.");
    await loadCollections();
  }

  async function submitNewCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createCollection(newName);
  }

  async function addAnimeToCollection(collectionId: string) {
    const animeId = Number(selectedAnime[collectionId]);

    if (!animeId) {
      return;
    }

    setMessage("");
    setError("");

    const { error: addError } = await supabase
      .from("anime_collection_items")
      .upsert(
        {
          collection_id: collectionId,
          anilist_id: animeId,
        },
        { onConflict: "collection_id,anilist_id" }
      );

    if (addError) {
      setError(addError.message);
      return;
    }

    setSelectedAnime((current) => ({ ...current, [collectionId]: "" }));
    setMessage("Anime added to collection.");
    await loadCollections();
  }

  return (
    <section className="mt-10 rounded-lg border border-line bg-white/[0.045] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-aqua">
            Collections
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Build mood boards from your saved anime.
          </h2>
        </div>
        <form
          onSubmit={submitNewCollection}
          className="flex w-full gap-2 sm:w-auto"
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New mood board"
            className="h-10 min-w-0 flex-1 rounded-md border border-white/12 bg-ink/62 px-3 text-sm font-semibold text-white outline-none placeholder:text-white/38 focus:border-ember focus:ring-2 focus:ring-ember/35 sm:w-56"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-ember px-3 text-sm font-semibold text-ink transition hover:bg-[#ff7a91]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create
          </button>
        </form>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {collectionPresets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => createCollection(preset.name, preset.description)}
            className="shrink-0 rounded-md border border-white/12 bg-white/8 px-3 py-2 text-left text-sm font-semibold text-white/72 transition hover:bg-white/12 hover:text-white"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {message ? (
        <p className="mt-4 rounded-md border border-aqua/25 bg-aqua/10 px-3 py-2 text-sm text-aqua">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-md border border-white/10 bg-white/8"
            />
          ))
        ) : collections.length ? (
          collections.map((collection) => (
            <article
              key={collection.id}
              className="rounded-md border border-white/10 bg-ink/35 p-4"
            >
              <div className="flex items-start gap-3">
                <FolderHeart
                  className="mt-1 h-5 w-5 shrink-0 text-ember"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h3 className="line-clamp-1 font-semibold text-white">
                    {collection.name}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-white/52">
                    {collection.description || "Custom anime mood board."}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/38">
                    {collection.itemCount} anime
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <select
                  value={selectedAnime[collection.id] ?? ""}
                  onChange={(event) =>
                    setSelectedAnime((current) => ({
                      ...current,
                      [collection.id]: event.target.value,
                    }))
                  }
                  className="h-10 rounded-md border border-white/12 bg-ink/70 px-3 text-sm font-semibold text-white outline-none focus:border-ember focus:ring-2 focus:ring-ember/35"
                >
                  <option value="">Add saved anime</option>
                  {savedAnime.map((anime) => (
                    <option key={anime.anilistId} value={anime.anilistId}>
                      {anime.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => addAnimeToCollection(collection.id)}
                  disabled={!selectedAnime[collection.id]}
                  className="h-9 rounded-md border border-white/12 bg-white/8 text-sm font-semibold text-white/70 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Add to board
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-md border border-white/10 bg-ink/35 p-4 text-sm leading-6 text-white/56 md:col-span-2 xl:col-span-4">
            Create your first mood board, then add saved anime from the selector.
          </div>
        )}
      </div>
    </section>
  );
}
