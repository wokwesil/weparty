import "server-only";
import { appleMusicConfigured, env } from "../env";
import type { Song } from "../types";
import { appleCatalogSearch } from "./apple";

/**
 * Song search used by the "Pick your party tracks" screen.
 *
 *  1. Apple Music API catalog search (when the Apple developer key is set up).
 *  2. Fallback: Apple's free public iTunes Search API. It returns the same
 *     Apple Music song IDs, artwork and links, with no account needed. Apple
 *     limits it to roughly 20 searches per minute per server, so results are
 *     cached and phones also call it directly if the server is throttled.
 */
const cache = new Map<string, { at: number; songs: Song[] }>();
const CACHE_MS = 10 * 60 * 1000;

export function searchSource(): "apple-music" | "itunes" | "test-catalog" {
  if (env.testMusicCatalog) return "test-catalog";
  return appleMusicConfigured() ? "apple-music" : "itunes";
}

export async function searchSongs(termRaw: string): Promise<{ songs: Song[]; source: string }> {
  const term = termRaw.trim().slice(0, 100);
  if (term.length < 2) return { songs: [], source: searchSource() };
  const key = `${searchSource()}:${term.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { songs: hit.songs, source: searchSource() };

  let songs: Song[];
  let source = searchSource();
  if (source === "test-catalog") {
    songs = testCatalogSearch(term);
  } else if (source === "apple-music") {
    try {
      songs = await appleCatalogSearch(term);
    } catch (err) {
      console.warn("[search] Apple Music failed, falling back to iTunes", err);
      songs = await itunesSearch(term);
      source = "itunes";
    }
  } else {
    songs = await itunesSearch(term);
  }
  cache.set(key, { at: Date.now(), songs });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return { songs, source };
}

type ItunesTrack = {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  trackViewUrl?: string;
  previewUrl?: string;
  trackExplicitness?: string;
};

export function fromItunes(t: ItunesTrack): Song | null {
  if (t.kind !== "song" || !t.trackId || !t.trackName || !t.artistName) return null;
  return {
    appleId: String(t.trackId),
    title: t.trackName,
    artist: t.artistName,
    album: t.collectionName ?? null,
    artworkUrl: t.artworkUrl100 ? t.artworkUrl100.replace(/\/\d+x\d+bb\./, "/600x600bb.") : null,
    durationMs: t.trackTimeMillis ?? null,
    isrc: null,
    appleUrl: t.trackViewUrl ? t.trackViewUrl.replace(/[?&]uo=\d+/, "") : null,
    previewUrl: t.previewUrl ?? null,
    explicit: t.trackExplicitness === "explicit",
  };
}

async function itunesSearch(term: string): Promise<Song[]> {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", term);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "25");
  url.searchParams.set("country", env.apple.storefront.toUpperCase());
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const json = (await res.json()) as { results?: ItunesTrack[] };
  return (json.results ?? []).map(fromItunes).filter((s): s is Song => Boolean(s));
}

/* ------------------------------------------------------------------------- */
/* TEST-ONLY catalog. Used by automated tests (WEPARTY_TEST_CATALOG=1) where  */
/* the internet isn't available. These are clearly fake songs and are never  */
/* served in production.                                                      */
/* ------------------------------------------------------------------------- */
const TEST_SONGS: Song[] = Array.from({ length: 60 }, (_, i) => ({
  appleId: `test-${i + 1}`,
  title: `[TEST] Party Song ${i + 1}`,
  artist: `[TEST] Artist ${(i % 12) + 1}`,
  album: `[TEST] Album ${(i % 6) + 1}`,
  artworkUrl: null,
  durationMs: 180000 + i * 1000,
  isrc: null,
  appleUrl: null,
  previewUrl: null,
  explicit: i % 9 === 0,
}));

function testCatalogSearch(term: string) {
  const t = term.toLowerCase();
  const words = t.split(/\s+/);
  return TEST_SONGS.filter((s) => words.every((w) => `${s.title} ${s.artist}`.toLowerCase().includes(w)) || t === "test").slice(0, 25);
}
