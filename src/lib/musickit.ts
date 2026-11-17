"use client";
import { isNativeApp } from "./native";
/**
 * Apple MusicKit on the web (official Apple library).
 * - The guest/host signs in to Apple Music in Apple's own window. WeParty never sees a password.
 * - After sign-in, Apple gives this browser a "music user token" that lets us read
 *   that person's library/playlists or create a playlist in *their own* library.
 * - Requires the WeParty Apple developer token (configured on the server).
 */
import { fromAppleResource, type AppleSongResource } from "./music/convert";
import type { Song } from "./types";

type MusicKitInstance = {
  authorize: () => Promise<string>;
  unauthorize: () => Promise<void>;
  isAuthorized: boolean;
  /** Playback (full songs need the signed-in person's own Apple Music subscription). */
  setQueue: (opts: { song?: string; songs?: string[]; startPlaying?: boolean }) => Promise<unknown>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekToTime: (seconds: number) => Promise<void>;
  playbackState: number;
  currentPlaybackTime: number;
  currentPlaybackDuration: number;
  volume: number;
  addEventListener: (name: string, cb: (e: { state?: number }) => void) => void;
  removeEventListener: (name: string, cb: (e: { state?: number }) => void) => void;
  api: {
    music: (path: string, query?: Record<string, unknown>, opts?: { fetchOptions?: RequestInit }) => Promise<{ data: unknown }>;
  };
};

declare global {
  interface Window {
    MusicKit?: {
      configure: (cfg: unknown) => Promise<MusicKitInstance>;
      getInstance: () => MusicKitInstance;
    };
  }
}

let loading: Promise<MusicKitInstance> | null = null;

export async function isAppleMusicAvailable() {
  // Apple's sign-in window can't open inside the iPhone/Android app, so Apple Music
  // features stay on the website (Safari/Chrome) for now.
  if (isNativeApp()) return false;
  const res = await fetch("/api/music/token", { cache: "no-store" });
  return res.ok;
}

/**
 * Whether the built-in host/DJ player is switched on (FEATURE_HOST_PLAYER=1 on the server)
 * and Apple Music is connected. Website only, same as the other Apple Music features.
 */
export async function isHostPlayerEnabled() {
  if (isNativeApp()) return false;
  const res = await fetch("/api/music/token", { cache: "no-store" });
  if (!res.ok) return false;
  const body = (await res.json().catch(() => ({}))) as { hostPlayer?: boolean };
  return body.hostPlayer === true;
}

/** MusicKit playback states (from Apple's MusicKit JS docs). */
export const PlaybackState = { playing: 2, paused: 3, stopped: 4, ended: 5, completed: 10 } as const;

export function getMusicKit(): Promise<MusicKitInstance> {
  if (loading) return loading;
  loading = (async () => {
    const res = await fetch("/api/music/token", { cache: "no-store" });
    if (!res.ok) throw new Error("Apple Music isn't connected to WeParty yet.");
    const { token } = (await res.json()) as { token: string };
    if (!window.MusicKit) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
        s.async = true;
        s.onerror = () => reject(new Error("Couldn't load Apple Music. Check your connection."));
        document.addEventListener("musickitloaded", () => resolve(), { once: true });
        document.head.appendChild(s);
      });
    }
    return window.MusicKit!.configure({ developerToken: token, app: { name: "WeParty", build: "1.0.0" } });
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export async function connectAppleMusic() {
  const mk = await getMusicKit();
  if (!mk.isAuthorized) await mk.authorize();
  return mk;
}

type Page<T> = { data?: T[]; next?: string };

async function getAll<T>(mk: MusicKitInstance, path: string, max = 300): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = path;
  while (next && out.length < max) {
    const res = (await mk.api.music(next, next === path ? { limit: 100 } : undefined)) as { data: Page<T> };
    out.push(...(res.data.data ?? []));
    next = res.data.next;
  }
  return out;
}

export type LibraryPlaylist = { id: string; name: string; artworkUrl: string | null };

export async function listMyPlaylists(mk: MusicKitInstance): Promise<LibraryPlaylist[]> {
  const items = await getAll<{ id: string; attributes?: { name?: string; artwork?: { url?: string } } }>(mk, "/v1/me/library/playlists", 200);
  return items.map((p) => ({
    id: p.id,
    name: p.attributes?.name ?? "Playlist",
    artworkUrl: p.attributes?.artwork?.url?.replace("{w}", "200").replace("{h}", "200") ?? null,
  }));
}

const toSongs = (items: AppleSongResource[]) =>
  items.filter((i) => !i.type || i.type.includes("song")).map(fromAppleResource).filter((s): s is Song => Boolean(s));

export async function playlistSongs(mk: MusicKitInstance, playlistId: string) {
  return toSongs(await getAll<AppleSongResource>(mk, `/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks`, 300));
}

export async function librarySongs(mk: MusicKitInstance) {
  return toSongs(await getAll<AppleSongResource>(mk, "/v1/me/library/songs", 300));
}

export async function recentlyPlayed(mk: MusicKitInstance) {
  const res = (await mk.api.music("/v1/me/recent/played/tracks", { limit: 30, types: "songs" })) as { data: Page<AppleSongResource> };
  return toSongs(res.data.data ?? []);
}

/**
 * Creates a playlist in the signed-in person's own Apple Music library.
 * Only catalog songs (numeric Apple Music ids) can be added.
 */
export async function createLibraryPlaylist(mk: MusicKitInstance, name: string, description: string, appleIds: string[]) {
  const ids = appleIds.filter((id) => /^\d+$/.test(id));
  const res = (await mk.api.music("/v1/me/library/playlists", undefined, {
    fetchOptions: {
      method: "POST",
      body: JSON.stringify({
        attributes: { name, description },
        relationships: { tracks: { data: ids.map((id) => ({ id, type: "songs" })) } },
      }),
    },
  })) as { data: { data?: { id: string }[] } };
  const id = res.data.data?.[0]?.id;
  return { id, added: ids.length, skipped: appleIds.length - ids.length };
}

/** Adds songs to the end of an existing library playlist (Apple's API can't remove or reorder). */
export async function appendToLibraryPlaylist(mk: MusicKitInstance, playlistId: string, appleIds: string[]) {
  const ids = appleIds.filter((id) => /^\d+$/.test(id));
  if (!ids.length) return 0;
  await mk.api.music(`/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks`, undefined, {
    fetchOptions: { method: "POST", body: JSON.stringify({ data: ids.map((id) => ({ id, type: "songs" })) }) },
  });
  return ids.length;
}
