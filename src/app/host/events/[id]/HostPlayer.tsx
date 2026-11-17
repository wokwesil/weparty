"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Artwork } from "@/components/Artwork";
import { useToast } from "@/components/Toast";
import { apiFetch, formatDuration } from "@/lib/client";
import { connectAppleMusic, isHostPlayerEnabled, PlaybackState } from "@/lib/musickit";
import type { QueueSnapshot } from "@/lib/types";

type MK = Awaited<ReturnType<typeof connectAppleMusic>>;

/**
 * Built-in WeParty player for the host/DJ screen (backup to Offtrack).
 *
 * - Hidden unless the server has FEATURE_HOST_PLAYER=1 and the Apple Music key is set.
 * - Plays full songs with the HOST's own Apple Music sign-in and subscription
 *   (Apple's MusicKit on the web). Guests never need Apple Music for this.
 * - Follows WeParty's "Now playing": when a song ends it moves the queue to the
 *   next song, and if someone taps "Next song" in the control room the player follows.
 * - Run it on ONE screen only, and not at the same time as Offtrack.
 */
export function HostPlayer({ eventId, snapshot, onChanged }: { eventId: string; snapshot: QueueSnapshot; onChanged: () => void }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<number>(0);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const [volume, setVolume] = useState(1);
  const [unplayable, setUnplayable] = useState<string | null>(null);

  const mkRef = useRef<MK | null>(null);
  const loadedRef = useRef<string | null>(null); // queue item id loaded into the player
  const advancingRef = useRef<string | null>(null); // queue item id we already moved past
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;

  const np = snapshot.nowPlaying;
  const ended = snapshot.event.status === "ended";

  useEffect(() => {
    isHostPlayerEnabled().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  /** Move WeParty's queue on from `fromId`, unless someone already did. */
  const advance = useCallback(
    async (fromId: string | null) => {
      const current = snapRef.current.nowPlaying?.id ?? null;
      if (current !== fromId || advancingRef.current === (fromId ?? "start")) return;
      advancingRef.current = fromId ?? "start";
      try {
        await apiFetch(`/api/host/events/${eventId}/queue`, { method: "POST", json: { type: "next" } });
        if (fromId === null) advancingRef.current = null;
        onChanged();
      } catch (e) {
        advancingRef.current = null;
        toast((e as Error).message, "error");
      }
    },
    [eventId, onChanged, toast],
  );

  // Listen to Apple's player while it's on.
  useEffect(() => {
    const mk = mkRef.current;
    if (!on || !mk) return;
    const onState = (e: { state?: number }) => {
      const st = e.state ?? mk.playbackState;
      setState(st);
      if ((st === PlaybackState.ended || st === PlaybackState.completed) && loadedRef.current) {
        void advance(loadedRef.current);
      }
    };
    const onError = () => {
      toast("Apple Music couldn't play this song. Check that your Apple Music subscription is active, or tap Skip.", "error");
    };
    mk.addEventListener("playbackStateDidChange", onState);
    mk.addEventListener("mediaPlaybackError", onError);
    const tick = setInterval(() => setTime({ now: mk.currentPlaybackTime || 0, total: mk.currentPlaybackDuration || 0 }), 1000);
    return () => {
      mk.removeEventListener("playbackStateDidChange", onState);
      mk.removeEventListener("mediaPlaybackError", onError);
      clearInterval(tick);
    };
  }, [on, advance, toast]);

  // Keep the player on WeParty's "Now playing" song.
  useEffect(() => {
    const mk = mkRef.current;
    if (!on || !mk) return;
    if (!np) {
      if (loadedRef.current) mk.stop();
      loadedRef.current = null;
      return;
    }
    if (np.id === loadedRef.current) return;
    loadedRef.current = np.id;
    advancingRef.current = null;
    if (!/^\d+$/.test(np.appleSongId)) {
      // Not an Apple Music catalog song (e.g. test data), so Apple can't play it.
      mk.stop();
      setUnplayable(np.title);
      return;
    }
    setUnplayable(null);
    mk.setQueue({ song: np.appleSongId, startPlaying: true }).catch(() =>
      toast(`Apple Music couldn't play “${np.title}”. Tap Skip to move on.`, "error"),
    );
  }, [on, np, toast]);

  // Keep the screen awake while the player is on (where the browser allows it).
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => (lock = l))
        .catch(() => undefined);
    void get();
    const vis = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);

  // Stop the music if the host leaves the control room.
  useEffect(() => () => mkRef.current?.stop(), []);

  if (!enabled || ended) return null;

  const start = async () => {
    setBusy(true);
    try {
      const mk = await connectAppleMusic();
      mkRef.current = mk;
      setVolume(mk.volume ?? 1);
      loadedRef.current = null;
      setOn(true);
      if (!snapRef.current.nowPlaying) await advance(null);
    } catch (e) {
      toast((e as Error).message || "Apple Music sign-in was cancelled.", "error");
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    mkRef.current?.stop();
    loadedRef.current = null;
    setOn(false);
  };

  const mk = mkRef.current;
  const playing = state === PlaybackState.playing;

  return (
    <section className="glass mb-4 flex flex-col gap-3 rounded-3xl p-4" aria-label="WeParty player">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold tracking-[0.3em] text-muted uppercase">WeParty player</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-100">Backup to Offtrack</span>
        <div className="flex-1" />
        {on ? (
          <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={stop}>Turn player off</button>
        ) : (
          <button className="btn btn-primary px-3 py-1.5 text-sm" disabled={busy} onClick={start}>
            {busy ? "Connecting…" : "▶ Play the queue here"}
          </button>
        )}
      </div>

      {!on && (
        <p className="text-xs text-muted">
          Plays the WeParty queue on this screen with your Apple Music (needs your own Apple Music subscription). Plug this laptop or iPad into the speakers. Use it on one screen only, and not while Offtrack is playing.
        </p>
      )}

      {on && (
        <div className="flex flex-wrap items-center gap-3">
          {np ? <Artwork src={np.artworkUrl} size={48} /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{np ? np.title : "Queue is empty"}</p>
            <p className="truncate text-xs text-muted">
              {np ? np.artist : "Add songs or wait for guests to pick some, then tap Play."}
              {np && time.total > 0 ? ` · ${formatDuration(time.now * 1000)} / ${formatDuration(time.total * 1000)}` : ""}
            </p>
            {np && time.total > 0 && (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-pink" style={{ width: `${Math.min(100, (time.now / time.total) * 100)}%` }} />
              </div>
            )}
            {unplayable && <p className="mt-1 text-xs text-amber-200">“{unplayable}” isn&apos;t an Apple Music song, so it can&apos;t play here. Tap Skip.</p>}
          </div>
          <div className="flex items-center gap-2">
            {np ? (
              <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => (playing ? mk?.pause() : void mk?.play())}>
                {playing ? "Pause" : "▶ Play"}
              </button>
            ) : (
              <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={snapshot.queue.length === 0} onClick={() => void advance(null)}>▶ Play</button>
            )}
            {np && (
              <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => void advance(np.id)}>⏭ Skip</button>
            )}
            <label className="flex items-center gap-1 text-xs text-muted">
              <span aria-hidden>🔊</span>
              <span className="sr-only">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (mk) mk.volume = v;
                }}
                className="w-20"
              />
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
