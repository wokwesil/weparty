"use client";
import { apiFetch } from "./client";
import type { Song } from "./types";

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

/** Last resort if the WeParty server is being rate-limited by Apple: ask Apple's public search from the phone itself. */
function itunesJsonp(term: string): Promise<Song[]> {
  return new Promise((resolve, reject) => {
    const cb = `__wp_itunes_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const s = document.createElement("script");
    const timer = setTimeout(() => cleanup(new Error("Search timed out")), 8000);
    const cleanup = (err?: Error, songs?: Song[]) => {
      clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cb];
      s.remove();
      if (err) reject(err);
      else resolve(songs ?? []);
    };
    (window as unknown as Record<string, unknown>)[cb] = (json: { results?: ItunesTrack[] }) => {
      const songs = (json.results ?? [])
        .filter((t) => t.kind === "song" && t.trackId && t.trackName && t.artistName)
        .map<Song>((t) => ({
          appleId: String(t.trackId),
          title: t.trackName!,
          artist: t.artistName!,
          album: t.collectionName ?? null,
          artworkUrl: t.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/600x600bb.") ?? null,
          durationMs: t.trackTimeMillis ?? null,
          isrc: null,
          appleUrl: t.trackViewUrl?.replace(/[?&]uo=\d+/, "") ?? null,
          previewUrl: t.previewUrl ?? null,
          explicit: t.trackExplicitness === "explicit",
        }));
      cleanup(undefined, songs);
    };
    s.src = `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(term)}&callback=${cb}`;
    s.onerror = () => cleanup(new Error("Search failed"));
    document.head.appendChild(s);
  });
}

export async function searchCatalog(term: string): Promise<{ songs: Song[]; source: string }> {
  const res = await apiFetch<{ songs: Song[]; source: string; fallback?: string }>(`/api/music/search?q=${encodeURIComponent(term)}`);
  if (res.fallback === "client-itunes") {
    return { songs: await itunesJsonp(term), source: "itunes" };
  }
  return res;
}
