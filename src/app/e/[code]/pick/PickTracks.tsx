"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Artwork } from "@/components/Artwork";
import { Backdrop, Wordmark } from "@/components/Brand";
import { SongBrowser } from "@/components/SongBrowser";
import { apiFetch } from "@/lib/client";
import type { Song } from "@/lib/types";

export function PickTracks({
  code,
  eventName,
  minPicks,
  maxPicks,
  alreadyPicked,
  submissionsOpen,
  allowExplicit,
}: {
  code: string;
  eventName: string;
  minPicks: number;
  maxPicks: number;
  alreadyPicked: string[];
  submissionsOpen: boolean;
  allowExplicit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Map<string, Song>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const already = alreadyPicked.length;
  const remaining = Math.max(0, maxPicks - already);
  const need = already === 0 ? minPicks : 1;
  const count = selected.size;
  const canSubmit = count >= need && count <= remaining && !busy;

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
        setError(`You can pick up to ${remaining} more song${remaining === 1 ? "" : "s"}.`);
        return prev;
      } else next.set(s.appleId, s);
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/e/${code}/songs`, { method: "POST", json: { songs: [...selected.values()] } });
      router.replace(`/e/${code}/party?added=${count}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const progress = Math.min(1, (already + count) / maxPicks);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-48 pt-[max(1rem,env(safe-area-inset-top))]">
      <Backdrop />
      <header className="flex items-center justify-between py-2">
        <Wordmark size="sm" />
        <Link href={`/e/${code}/party`} className="text-sm text-muted hover:text-white">
          {already > 0 ? "Back to queue →" : "Skip for now →"}
        </Link>
      </header>
      <section className="mb-5 mt-6">
        <p className="text-xs font-semibold tracking-[0.3em] text-muted uppercase">{eventName}</p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight sm:text-4xl">
          PICK YOUR <span className="text-gradient">PARTY TRACKS</span>
        </h1>
        <p className="mt-2 text-muted">
          {already === 0
            ? `Choose ${minPicks === maxPicks ? minPicks : `${minPicks} to ${maxPicks}`} songs. The crowd decides what plays next.`
            : remaining > 0
              ? `You've added ${already}. You can add ${remaining} more.`
              : `You've added all ${maxPicks} of your songs. Go heart some others!`}
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full bg-brand" animate={{ width: `${progress * 100}%` }} />
        </div>
      </section>

      {!submissionsOpen && (
        <p className="mb-4 rounded-2xl bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
          The host has paused song requests for a bit. You can still pick songs and try sending them soon.
        </p>
      )}

      {remaining > 0 ? (
        <SongBrowser selected={selected} onToggle={toggle} lockedIds={alreadyPicked} />
      ) : (
        <Link href={`/e/${code}/party`} className="btn btn-primary self-center">
          Go to the live queue
        </Link>
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
                      <button className="px-2 text-muted hover:text-white" onClick={() => toggle(s)} aria-label={`Remove ${s.title}`}>
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
                className="flex -space-x-3 pl-1"
                onClick={() => setTrayOpen((o) => !o)}
                aria-label="Show selected songs"
                disabled={count === 0}
              >
                {count === 0 ? (
                  <span className="text-sm text-muted">No songs picked yet</span>
                ) : (
                  [...selected.values()].slice(-4).map((s) => <Artwork key={s.appleId} src={s.artworkUrl} size={36} className="ring-2 ring-night" />)
                )}
              </button>
              <div className="ml-auto text-right text-xs text-muted">
                <span className="font-display text-lg font-bold text-white">{count}</span>/{remaining}
                {count < need && <div>pick {need - count} more</div>}
              </div>
              <button className="btn btn-primary" disabled={!canSubmit || !submissionsOpen} onClick={submit}>
                {busy ? "Adding…" : "ADD TO PARTY"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
