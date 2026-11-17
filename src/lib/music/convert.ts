import type { Song } from "../types";

/** Shared by the server and the browser: turns Apple Music API song data into a WeParty song. */
export type AppleSongResource = {
  id: string;
  type?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    artwork?: { url?: string };
    durationInMillis?: number;
    isrc?: string;
    url?: string;
    previews?: { url?: string }[];
    contentRating?: string;
    genreNames?: string[];
    playParams?: { id?: string; catalogId?: string; isLibrary?: boolean };
  };
};

export function artworkFromTemplate(url: string | undefined, size = 600) {
  if (!url) return null;
  return url.replace("{w}", String(size)).replace("{h}", String(size)).replace("{f}", "jpg");
}

export function fromAppleResource(r: AppleSongResource): Song | null {
  const a = r.attributes;
  if (!a?.name || !a.artistName) return null;
  // Library songs have private ids; use the catalog id so the same song from
  // different people's libraries counts as one and can go into playlists.
  const catalogId = a.playParams?.catalogId ?? (/^\d+$/.test(r.id) ? r.id : null);
  if (!catalogId) return null; // personal uploads can't be shared or added to playlists
  return {
    appleId: catalogId,
    title: a.name,
    artist: a.artistName,
    album: a.albumName ?? null,
    artworkUrl: artworkFromTemplate(a.artwork?.url),
    durationMs: a.durationInMillis ?? null,
    isrc: a.isrc ?? null,
    appleUrl: a.url ?? null,
    previewUrl: a.previews?.[0]?.url ?? null,
    explicit: a.contentRating === "explicit",
    genre: a.genreNames?.find((g) => g !== "Music") ?? null,
  };
}
