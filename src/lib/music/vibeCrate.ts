import "server-only";
import { env } from "../env";
import type { Song } from "../types";
import { getVibe, songFitsVibe } from "../vibes";
import { searchSongs } from "./search";

/**
 * A vibe's "starter crate": songs guests can tap without typing anything.
 * Built from a handful of the vibe's seed searches (each one is cached for
 * every party in the search cache, so Apple is asked rarely), mixed so one
 * artist doesn't fill the list, and kept only if Apple's genre fits the vibe.
 */
const SEEDS_PER_CRATE = 5;
const CRATE_SIZE = 40;
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; songs: Song[] }>();

export async function vibeCrate(vibeId: string): Promise<Song[]> {
  const vibe = getVibe(vibeId);
  if (!vibe) return [];
  const hit = cache.get(vibeId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.songs;

  // Rotate which seeds we use every day so regulars see a fresh crate.
  const day = Math.floor(Date.now() / 86_400_000);
  const seeds = env.testMusicCatalog
    ? ["test"]
    : Array.from({ length: Math.min(SEEDS_PER_CRATE, vibe.seeds.length) }, (_, i) => vibe.seeds[(day + i) % vibe.seeds.length]);

  const lists = await Promise.all(
    seeds.map((term) =>
      searchSongs(term)
        .then((r) => r.songs.filter((s) => songFitsVibe(s, vibe) === true))
        .catch(() => [] as Song[]),
    ),
  );

  // Round-robin across seeds: 1st song of each search, then 2nd of each…
  const seen = new Set<string>();
  const songs: Song[] = [];
  for (let i = 0; songs.length < CRATE_SIZE && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const s = list[i];
      if (!s || seen.has(s.appleId)) continue;
      const titleKey = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`;
      if (seen.has(titleKey)) continue; // same song from a different album
      seen.add(s.appleId);
      seen.add(titleKey);
      songs.push(s);
      if (songs.length >= CRATE_SIZE) break;
    }
  }
  // Don't remember an empty crate (Apple may have been busy for a moment).
  if (songs.length > 0) cache.set(vibeId, { at: Date.now(), songs });
  return songs;
}
