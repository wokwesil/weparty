"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { apiFetch } from "@/lib/client";
import { isNativeApp } from "@/lib/native";
import { appendToLibraryPlaylist, connectAppleMusic, createLibraryPlaylist, isAppleMusicAvailable } from "@/lib/musickit";
import type { QueueSnapshot } from "@/lib/types";

/**
 * Host-only Apple Music tools. Everything here uses the HOST's own Apple Music
 * sign-in and writes only to the host's own library. Guests save the replay to
 * their own libraries from the replay page with their own sign-in.
 *
 * Offtrack has no public API (checked Nov 2026), so the hand-off is an Apple
 * Music playlist that Offtrack can open from the host's library.
 */
export function OfftrackPanel({
  eventId,
  code,
  snapshot,
  livePlaylistId,
  onChanged,
}: {
  eventId: string;
  code: string;
  snapshot: QueueSnapshot;
  livePlaylistId: string | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [pushed, setPushed] = useState<string[]>([]);
  const storeKey = `weparty:pushed:${eventId}:${livePlaylistId ?? "none"}`;

  useEffect(() => {
    isAppleMusicAvailable().then(setAvailable).catch(() => setAvailable(false));
  }, []);
  useEffect(() => {
    try {
      setPushed(JSON.parse(localStorage.getItem(storeKey) ?? "[]"));
    } catch {
      setPushed([]);
    }
  }, [storeKey]);
  const remember = (ids: string[]) => {
    setPushed(ids);
    try {
      localStorage.setItem(storeKey, JSON.stringify(ids));
    } catch {
      /* private mode */
    }
  };

  const played = [...snapshot.history].sort((a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0));
  const upcoming = [...(snapshot.nowPlaying ? [snapshot.nowPlaying] : []), ...snapshot.queue];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message || "Apple Music sign-in was cancelled.", "error");
    } finally {
      setBusy(false);
    }
  };

  const createReplay = () =>
    run(async () => {
      const mk = await connectAppleMusic();
      const all = [...played, ...(snapshot.nowPlaying ? [snapshot.nowPlaying] : [])];
      const res = await createLibraryPlaylist(mk, `WeParty · ${snapshot.event.name}`, `Songs played at ${snapshot.event.name}, in order. Picked and voted by the crowd on WeParty.`, all.map((s) => s.appleSongId));
      toast(`Replay playlist saved to your Apple Music (${res.added} songs).`, "success");
    });

  const createLive = () =>
    run(async () => {
      const mk = await connectAppleMusic();
      const take = upcoming.slice(0, 15);
      const res = await createLibraryPlaylist(mk, `WeParty LIVE · ${snapshot.event.name}`, "Live WeParty queue for Offtrack. Songs are added in crowd order.", take.map((s) => s.appleSongId));
      if (!res.id) throw new Error("Apple Music didn't return the new playlist.");
      await apiFetch(`/api/host/events/${eventId}`, { method: "PATCH", json: { liveApplePlaylistId: res.id } });
      localStorage.setItem(`weparty:pushed:${eventId}:${res.id}`, JSON.stringify(take.map((s) => s.appleSongId)));
      toast(`Live playlist created with ${res.added} songs. Open it in Offtrack.`, "success");
      onChanged();
    });

  const pushNext = () =>
    run(async () => {
      if (!livePlaylistId) return;
      const mk = await connectAppleMusic();
      const fresh = upcoming.filter((s) => !pushed.includes(s.appleSongId)).slice(0, 10);
      if (!fresh.length) {
        toast("Everything in the queue is already in the live playlist.");
        return;
      }
      const n = await appendToLibraryPlaylist(mk, livePlaylistId, fresh.map((s) => s.appleSongId));
      remember([...pushed, ...fresh.map((s) => s.appleSongId)]);
      toast(`Added ${n} songs to the live playlist.`, "success");
    });

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="glass flex flex-col gap-4 rounded-3xl p-5">
        <h2 className="font-display text-lg font-bold">Apple Music</h2>
        {available === false && isNativeApp() && (
          <p className="rounded-2xl bg-amber-500/15 p-3 text-sm text-amber-100">
            Apple Music sign-in only works in a web browser. Open this control room in Safari or Chrome on your phone or laptop to make
            Apple Music playlists.
          </p>
        )}
        {available === false && !isNativeApp() && (
          <p className="rounded-2xl bg-amber-500/15 p-3 text-sm text-amber-100">
            Apple Music isn&apos;t connected to WeParty yet (it needs the Apple Developer key; see docs/APPLE_MUSIC.md). Until then, use the exports in
            “QR, details &amp; export”: every song has its Apple Music link.
          </p>
        )}
        <div>
          <p className="font-semibold">YOUR WEPARTY REPLAY playlist</p>
          <p className="text-sm text-muted">
            Creates a playlist of the {played.length} songs actually played, in order, in <b>your</b> Apple Music library.
          </p>
          <button className="btn btn-primary mt-3" disabled={!available || busy || played.length + (snapshot.nowPlaying ? 1 : 0) === 0} onClick={createReplay}>
            Create replay playlist
          </button>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted">
            <li>Open the Music app and find the new “WeParty · {snapshot.event.name}” playlist.</li>
            <li>Optional: tap ⋯ → Share Playlist → Copy link (Apple may ask you to set up a public profile).</li>
            <li>Paste the link under “QR, details &amp; export” → Public Apple Music playlist link. Guests then get an “Open on Apple Music” button.</li>
          </ol>
          <p className="mt-2 text-xs text-muted">
            Guests can also tap “Add to my Apple Music” on the <a className="text-pink underline" href={`/e/${code}/replay`}>replay page</a>, which saves a copy to their own library with their own sign-in.
          </p>
        </div>
      </div>

      <div className="glass flex flex-col gap-4 rounded-3xl p-5">
        <h2 className="font-display text-lg font-bold">Play it in Offtrack</h2>
        <p className="text-sm text-muted">
          Offtrack (the AI DJ app) works with Apple Music playlists but has no public API for other apps to control it. So WeParty hands the crowd&apos;s order to Offtrack through a playlist in your Apple Music library:
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Create the live playlist (first 15 songs in WeParty order).</li>
          <li>In Offtrack, open that playlist from your Apple Music library and start the mix.</li>
          <li>As the night goes on, tap “Add next songs” to append the newest top songs.</li>
          <li>When Offtrack moves to a new song, tap “Next song” in the Live queue tab so WeParty&apos;s Now Playing and replay stay accurate.</li>
        </ol>
        <p className="text-xs text-muted">
          Apple&apos;s API can add songs to a playlist but can&apos;t reorder or remove them, so only new songs are appended. Test with your Offtrack version before the party: it may need you to reopen the playlist to see new songs.
        </p>
        {livePlaylistId ? (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={!available || busy} onClick={pushNext}>Add next songs</button>
            <button className="btn btn-ghost" disabled={!available || busy} onClick={createLive}>Start a new live playlist</button>
          </div>
        ) : (
          <button className="btn btn-primary" disabled={!available || busy || upcoming.length === 0} onClick={createLive}>
            Create live playlist
          </button>
        )}
        {livePlaylistId && <p className="text-xs text-muted">{pushed.length} songs sent to the live playlist from this device.</p>}
        <p className="text-xs text-muted">No Apple Music yet? Export “Upcoming queue (.txt)” and import it with a playlist-transfer tool, or have the DJ search songs in Offtrack by the list.</p>
      </div>
    </section>
  );
}
