"use client";
import { useEffect, useRef, useState } from "react";
import { Artwork } from "./Artwork";
import { searchCatalog } from "@/lib/client-search";
import { formatDuration } from "@/lib/client";
import {
  connectAppleMusic,
  isAppleMusicAvailable,
  librarySongs,
  listMyPlaylists,
  playlistSongs,
  recentlyPlayed,
  type LibraryPlaylist,
} from "@/lib/musickit";
import type { Song } from "@/lib/types";

type Mode = "search" | "apple";

/** Search Apple Music (or the free Apple catalog fallback), or browse your own Apple Music library. */
export function SongBrowser({
  selected,
  onToggle,
  lockedIds = [],
  lockedLabel = "Added",
}: {
  selected: Map<string, Song>;
  onToggle: (song: Song) => void;
  lockedIds?: string[];
  lockedLabel?: string;
}) {
  const [mode, setMode] = useState<Mode>("search");
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    isAppleMusicAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {appleAvailable && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-night-2 p-1 text-sm font-semibold" role="tablist">
          {(["search", "apple"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 rounded-full py-2 transition ${mode === m ? "bg-white text-night" : "text-muted"}`}
            >
              {m === "search" ? "Search all music" : " My Apple Music"}
            </button>
          ))}
        </div>
      )}
      {mode === "search" ? (
        <SearchPane selected={selected} onToggle={onToggle} lockedIds={lockedIds} lockedLabel={lockedLabel} />
      ) : (
        <ApplePane selected={selected} onToggle={onToggle} lockedIds={lockedIds} lockedLabel={lockedLabel} />
      )}
    </div>
  );
}

function SearchPane(props: Parameters<typeof SongBrowser>[0]) {
  const [q, setQ] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSongs([]);
      setError(null);
      return;
    }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCatalog(term);
        if (my === seq.current) {
          setSongs(res.songs);
          setError(null);
        }
      } catch (e) {
        if (my === seq.current) setError((e as Error).message);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 stroke-muted" fill="none" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="field pl-12"
          type="search"
          placeholder="Search songs or artists"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search songs"
          enterKeyHint="search"
        />
      </div>
      {loading && <p className="text-center text-sm text-muted">Searching…</p>}
      {error && <p className="text-center text-sm text-rose-300">{error}</p>}
      {!loading && q.trim().length >= 2 && songs.length === 0 && !error && (
        <p className="text-center text-sm text-muted">No songs found. Try another search.</p>
      )}
      <SongList songs={songs} {...props} label="Search results" />
    </div>
  );
}

function ApplePane(props: Parameters<typeof SongBrowser>[0]) {
  const [state, setState] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<LibraryPlaylist[]>([]);
  const [view, setView] = useState<{ title: string; songs: Song[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const mkRef = useRef<Awaited<ReturnType<typeof connectAppleMusic>> | null>(null);

  const connect = async () => {
    setState("connecting");
    setError(null);
    try {
      const mk = await connectAppleMusic();
      mkRef.current = mk;
      setPlaylists(await listMyPlaylists(mk));
      setState("ready");
    } catch (e) {
      setError((e as Error).message || "Apple Music sign-in was cancelled.");
      setState("error");
    }
  };

  const open = async (title: string, load: () => Promise<Song[]>) => {
    setLoading(true);
    setError(null);
    try {
      setView({ title, songs: await load() });
    } catch (e) {
      setError((e as Error).message || "Couldn't load that from Apple Music.");
    } finally {
      setLoading(false);
    }
  };

  if (state !== "ready") {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
        <p className="font-semibold">Pick from your own Apple Music library and playlists</p>
        <p className="text-sm text-muted">You&apos;ll sign in on Apple&apos;s own screen. WeParty never sees your password and only reads your music.</p>
        <button className="btn btn-primary" onClick={connect} disabled={state === "connecting"}>
          {state === "connecting" ? "Connecting…" : "Connect Apple Music"}
        </button>
        {error && (
          <p className="text-sm text-rose-300">
            {error} You can still use “Search all music”.
          </p>
        )}
      </div>
    );
  }

  const mk = mkRef.current!;
  if (view) {
    return (
      <div className="flex flex-col gap-3">
        <button className="self-start text-sm text-muted hover:text-white" onClick={() => setView(null)}>
          ← Back to my library
        </button>
        <h3 className="font-display text-lg font-bold">{view.title}</h3>
        {view.songs.length === 0 && <p className="text-sm text-muted">No Apple Music catalog songs here.</p>}
        <SongList songs={view.songs} {...props} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {loading && <p className="text-sm text-muted">Loading…</p>}
      <button className="glass rounded-2xl p-4 text-left font-semibold" onClick={() => open("Recently played", () => recentlyPlayed(mk))}>
        🕘 Recently played
      </button>
      <button className="glass rounded-2xl p-4 text-left font-semibold" onClick={() => open("Library songs", () => librarySongs(mk))}>
        🎵 All library songs
      </button>
      <p className="mt-3 text-xs font-semibold tracking-widest text-muted uppercase">Your playlists</p>
      {playlists.length === 0 && <p className="text-sm text-muted">No playlists found.</p>}
      {playlists.map((p) => (
        <button key={p.id} className="flex items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/5" onClick={() => open(p.name, () => playlistSongs(mk, p.id))}>
          <Artwork src={p.artworkUrl} size={44} />
          <span className="truncate font-medium">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

let audio: HTMLAudioElement | null = null;

export function SongList({
  songs,
  selected,
  onToggle,
  lockedIds = [],
  lockedLabel = "Added",
  label,
}: Parameters<typeof SongBrowser>[0] & { songs: Song[]; label?: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio?.pause(), []);
  const preview = (s: Song) => {
    if (!s.previewUrl) return;
    if (!audio) audio = new Audio();
    if (playing === s.appleId) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.src = s.previewUrl;
    audio.volume = 0.8;
    audio.play().catch(() => {});
    audio.onended = () => setPlaying(null);
    setPlaying(s.appleId);
  };
  return (
    <ul className="flex flex-col gap-1" aria-label={label}>
      {songs.map((s) => {
        const isSel = selected.has(s.appleId);
        const locked = lockedIds.includes(s.appleId);
        return (
          <li key={s.appleId}>
            <div
              className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${isSel ? "bg-violet/20 ring-1 ring-violet/60" : "hover:bg-white/5"}`}
            >
              {s.previewUrl ? (
                <button
                  type="button"
                  className="relative shrink-0"
                  onClick={() => preview(s)}
                  aria-label={playing === s.appleId ? `Stop preview of ${s.title}` : `Play a preview of ${s.title}`}
                  aria-pressed={playing === s.appleId}
                >
                  <Artwork src={s.artworkUrl} size={52} />
                  <span aria-hidden className="absolute inset-0 grid place-items-center rounded-xl bg-black/35 text-sm text-white opacity-90">
                    {playing === s.appleId ? "❚❚" : "▶"}
                  </span>
                </button>
              ) : (
                <Artwork src={s.artworkUrl} size={52} />
              )}
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => !locked && onToggle(s)} disabled={locked}>
                <p className="truncate font-semibold">
                  {s.title} {s.explicit && <span className="ml-1 rounded bg-white/15 px-1 text-[10px] align-middle">E</span>}
                </p>
                <p className="truncate text-sm text-muted">
                  {s.artist}
                  {s.durationMs ? ` · ${formatDuration(s.durationMs)}` : ""}
                </p>
              </button>
              <button
                type="button"
                onClick={() => !locked && onToggle(s)}
                disabled={locked}
                className={`grid h-11 min-w-11 place-items-center rounded-full px-2 text-sm font-bold transition ${
                  locked ? "text-xs text-muted" : isSel ? "bg-brand text-white" : "border border-line text-white/80"
                }`}
                aria-label={isSel ? `Remove ${s.title}` : `Add ${s.title}`}
              >
                {locked ? lockedLabel : isSel ? "✓" : "+"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
