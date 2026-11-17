/**
 * DJ blocklist matching (shared by the server and tests).
 *
 * A "song" block matches one exact Apple Music song.
 * An "artist" block matches that artist anywhere in the artist credit,
 * including features: blocking "Drake" also blocks "Future & Drake" and
 * "Rihanna feat. Drake", but not "Drake Bell" or "Nick Drake".
 */
export type BlockEntry = { kind: "song" | "artist"; value: string; label: string };

export function normalizeArtist(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Splits "A, B & C feat. D" into ["a", "b", "c", "d"]. */
export function artistCredits(artist: string): string[] {
  return normalizeArtist(artist)
    .split(/\s*(?:,|&|\+|\/|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bx\b|\bvs\.?)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function blockMatch(song: { appleId: string; artist: string }, blocks: BlockEntry[]): BlockEntry | null {
  let credits: string[] | null = null;
  for (const b of blocks) {
    if (b.kind === "song" && b.value === song.appleId) return b;
    if (b.kind === "artist") {
      credits ??= [normalizeArtist(song.artist), ...artistCredits(song.artist)];
      if (credits.includes(b.value)) return b;
    }
  }
  return null;
}
