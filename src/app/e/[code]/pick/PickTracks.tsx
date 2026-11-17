"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Artwork } from "@/components/Artwork";
import { Backdrop, Wordmark } from "@/components/Brand";
import { SongBrowser, SongList } from "@/components/SongBrowser";
import { ApiError, apiFetch } from "@/lib/client";
import { trackStep } from "@/lib/device";
import { hapticTap } from "@/lib/native";
import type { Song } from "@/lib/types";

const plural = (n: number, word = "song") => `${n} ${word}${n === 1 ? "" : "s"}`;

export function PickTracks({
  code,
  eventName,
  minPicks,
  maxPicks,
  alreadyPicked,
  submissionsOpen,
  allowExplicit,
  approvalMode,
  partySongs,
}: {
  code: string;
  eventName: string;
  minPicks: number;
  maxPicks: number;
  alreadyPicked: string[];
  submissionsOpen: boolean;
  allowExplicit: boolean;
  approvalMode: boolean;
  partySongs: Song[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Map<string, Song>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const tracked = useRef(false);

  const already = alreadyPicked.length;
  const firstTime = already === 0;
  const remaining = Math.max(0, maxPicks - already);
  const need = firstTime ? minPicks : 1;
  const count = selected.size;
  const canSubmit = count >= need && count <= remaining && !busy && submissionsOpen;

  useEffect(() => {
    router.prefetch(`/e/${code}/party`);
  }, [code, router]);

  const toggle = (s: Song) => {
    setError(null);
    if (!allowExplicit && s.explicit) {
      setError("This party is clean-only, so explicit songs can't be added.");
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(s.appleId)) next.delete(s.appleId);
      else if (next.size >= remaining) {
        setError(
          remaining === 1 ? "You can add 1 more song. Tap a picked song to swap it." : `You can pick up to ${remaining} more songs.`,
        );
        return prev;
      } else {
        next.set(s.appleId, s);
        hapticTap();
        if (!tracked.current) {
          tracked.current = true;
          trackStep(code, "picked");
        }
      }
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ pending: number; firstTime: boolean }>(`/api/e/${code}/songs`, {
        method: "POST",
        json: { songs: [...selected.values()] },
      });
      if (firstTime) trackStep(code, "joined");
      router.replace(`/e/${code}/party?added=${count}${res.pending ? `&pending=${res.pending}` : ""}`);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      setBusy(false);
    }
  };

  const buttonLabel = busy
    ? "Adding…"
    : firstTime
      ? count === 0
        ? minPicks > 1
          ? `PICK ${minPicks} SONGS TO JOIN`
          : "PICK A SONG TO JOIN"
        : count < need
          ? `PICK ${need - count} MORE`
          : `JOIN WITH ${plural(count).toUpperCase()}`
      : count === 0
        ? "PICK A SONG"
        : `ADD ${plural(count).toUpperCase()}`;

  const progress = Math.min(1, (already + count) / maxPicks);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-48 pt-[max(1rem,env(safe-area-inset-top))]">
      <Backdrop />
      <header className="flex items-center justify-between py-2">
        <Wordmark size="sm" />
        <Link href={`/e/${code}/party`} className="py-2 text-sm text-muted hover:text-white">
          {firstTime ? "Look around first →" : "Back to the party →"}
        </Link>
      </header>
      <section className="mb-4 mt-4">
        <p className="text-xs font-semibold tracking-[0.3em] text-muted uppercase">{eventName}</p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight">
          {firstTime ? (
            <>
              PICK A SONG <span className="text-gradient">TO GET IN</span>
            </>
          ) : (
            <>
              ADD MORE <span className="text-gradient">SONGS</span>
            </>
          )}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {firstTime
            ? minPicks > 1
              ? `Pick ${minPicks} songs to join (up to ${maxPicks}). You can add more all night.`
              : `One song is enough. You can add up to ${maxPicks} tonight.`
            : remaining > 0
              ? `You've added ${already}. You can add ${remaining} more.`
              : `You've added all ${maxPicks} of your songs. Go heart some others!`}
          {approvalMode && " The DJ approves requests before they hit the queue."}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <motion.div className="h-full bg-brand" animate={{ width: `${progress * 100}%` }} />
        </div>
      </section>

      {!submissionsOpen && (
        <p className="mb-4 rounded-2xl bg-amber-500/15 px-4 py-3 text-sm text-amber-100" role="status">
          The host has paused song requests for a bit. You can still pick songs and send them when requests reopen.
        </p>
      )}

      {remaining > 0 ? (
        <>
          <SongBrowser selected={selected} onToggle={toggle} lockedIds={alreadyPicked} />
          {partySongs.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 px-1 text-xs font-bold tracking-[0.3em] text-muted uppercase">Already at this party · tap to back one</h2>
              <SongList songs={partySongs} selected={selected} onToggle={toggle} lockedIds={alreadyPicked} label="Songs already at this party" />
            </section>
          )}
        </>
      ) : (
        <div className="glass flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
          <p className="font-semibold">Song limit reached</p>
          <p className="text-sm text-muted">You&apos;ve added all {maxPicks} of your songs. Hearts are unlimited!</p>
          <Link href={`/e/${code}/party`} className="btn btn-primary">
            Go to the live queue
          </Link>
        </div>
      )}

      {remaining > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="glass mx-auto max-w-xl rounded-3xl p-3 shadow-2xl">
            <AnimatePresence>
              {trayOpen && count > 0 && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-2 max-h-56 overflow-y-auto"
                >
                  {[...selected.values()].map((s) => (
                    <li key={s.appleId} className="flex items-center gap-3 rounded-xl p-1.5">
                      <Artwork src={s.artworkUrl} size={36} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <b>{s.title}</b> <span className="text-muted">· {s.artist}</span>
                      </span>
                      <button className="grid h-11 w-11 place-items-center text-muted hover:text-white" onClick={() => toggle(s)} aria-label={`Remove ${s.title}`}>
                        ✕
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
            {error && <p className="mb-2 px-1 text-sm text-rose-300" role="alert">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                className="flex min-h-11 -space-x-3 pl-1"
                onClick={() => setTrayOpen((o) => !o)}
                aria-label={`Show ${plural(count)} you picked`}
                disabled={count === 0}
              >
                {count === 0 ? (
                  <span className="self-center text-xs text-muted">{firstTime ? "Search or tap a song" : `${remaining} left`}</span>
                ) : (
                  [...selected.values()].slice(-3).map((s) => <Artwork key={s.appleId} src={s.artworkUrl} size={40} className="ring-2 ring-night" />)
                )}
              </button>
              <button className="btn btn-primary ml-auto min-h-12 flex-1 text-sm sm:flex-none" disabled={!canSubmit} onClick={submit}>
                {buttonLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
