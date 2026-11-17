"use client";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Artwork } from "@/components/Artwork";
import { Avatar, InstagramLink } from "@/components/Avatar";
import { Wordmark } from "@/components/Brand";
import { shareLink } from "@/lib/native";
import { Requester } from "@/components/SongCard";
import { SongBrowser } from "@/components/SongBrowser";
import { StatusPill } from "@/components/StatusPill";
import { ToastProvider, useToast } from "@/components/Toast";
import { apiFetch, formatDuration } from "@/lib/client";
import type { PartySettings } from "@/lib/ranking";
import type { QueueSnapshot, Song, SongView } from "@/lib/types";
import { useLiveData } from "@/lib/useLive";
import { CrowdPulse, DjBooth, DjModePanel, type Block } from "./DjBooth";
import { OfftrackPanel } from "./OfftrackPanel";

type HostState = {
  role: "owner" | "admin" | "dj";
  snapshot: QueueSnapshot;
  settings: PartySettings;
  people: { id: string; displayName: string; instagram: string; avatarUrl: string | null; joinedAt: string; heartsReceived: number; songs: { id: string }[] }[];
  log: { id: number; actor: string; action: string; details: Record<string, unknown>; created_at: string }[];
  hidden: { id: string; title: string; artist: string; status: string }[];
  liveApplePlaylistId: string | null;
  blocks: Block[];
  reports: { id: number; guestId: string; reason: string; createdAt: string }[];
  djPhotoUrl: string | null;
  features?: { sponsor: boolean; payments: boolean; plans: boolean };
};

type Details = { name: string; venueName: string; description: string; startsAt: string; replayAppleUrl: string };
type Panel = "queue" | "pulse" | "dj" | "guests" | "settings" | "share" | "apple";

export function ControlRoom(props: { eventId: string; code: string; joinUrl: string; initial: Details; role: string }) {
  return (
    <ToastProvider>
      <MotionConfig reducedMotion="user">
      <Room {...props} />
      </MotionConfig>
    </ToastProvider>
  );
}

function Room({ eventId, code, joinUrl, initial }: { eventId: string; code: string; joinUrl: string; initial: Details; role: string }) {
  const toast = useToast();
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("queue");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data, refresh, connected, status: live } = useLiveData<HostState>(`/api/host/events/${eventId}/state`, eventId, {
    onUnauthorized: () => router.replace("/host/login"),
  });

  const act = async (body: Record<string, unknown>, msg?: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/host/events/${eventId}/queue`, { method: "POST", json: body });
      if (msg) toast(msg, "success");
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const status = async (action: "pause" | "resume" | "end" | "reopen") => {
    setBusy(true);
    try {
      await apiFetch(`/api/host/events/${eventId}/status`, { method: "POST", json: { action } });
      toast(
        { pause: "Song requests paused", resume: "Song requests are open", end: "Event ended. The replay is ready!", reopen: "Event reopened" }[action],
        "success",
      );
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <main className="grid min-h-dvh place-items-center text-muted">Loading…</main>;
  const { snapshot: s } = data;
  const ended = s.event.status === "ended";
  const dj = data.settings.djMode;

  return (
    <main className={`mx-auto min-h-dvh max-w-6xl px-3 pb-20 pt-3 sm:px-6 ${dj ? "bg-black" : ""}`}>
      <header className="sticky top-0 z-20 -mx-3 flex flex-wrap items-center gap-3 bg-night/80 px-3 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <Link href="/host" className="tap text-sm text-muted hover:text-white">← Events</Link>
        <Wordmark size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black tracking-[0.3em] text-lime uppercase">{dj ? "DJ Booth" : "Control room"}</p>
          <p className="truncate font-bold">{s.event.name}</p>
          <p className="flex items-center gap-2 text-xs text-muted">
            <StatusPill status={s.event.status} open={s.event.submissionsOpen} />
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-lime" : "bg-amber-400"}`} title={connected ? "Live updates connected" : "Checking every few seconds"} />
            {s.stats.guests} guests · {s.queue.length} queued{s.stats.pending ? ` · ${s.stats.pending} pending` : ""} · {s.stats.votes} hearts
            {live === "offline" && <span className="text-rose-300">· reconnecting…</span>}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href={`/host/events/${eventId}/check`} className="tap rounded-full bg-white/5 px-3 py-2 text-muted hover:text-white">✅ Party check</Link>
          <Link href={`/host/events/${eventId}/insights`} className="tap rounded-full bg-white/5 px-3 py-2 text-muted hover:text-white">Insights</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {!ended &&
            (s.event.submissionsOpen ? (
              <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => status("pause")} disabled={busy}>⏸ Pause requests</button>
            ) : (
              <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => status("resume")} disabled={busy}>▶ Resume requests</button>
            ))}
          {ended ? (
            <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => status("reopen")} disabled={busy || data.role === "dj"}>Reopen event</button>
          ) : (
            <ConfirmButton className="btn btn-danger px-3 py-2 text-sm" onConfirm={() => status("end")} disabled={busy} confirmLabel="Tap again to end">
              End event
            </ConfirmButton>
          )}
        </div>
      </header>

      {ended && (
        <Link href={`/e/${code}/replay`} className="mt-3 block rounded-2xl bg-brand p-4 text-center font-bold">
          🎧 This event has ended. Open YOUR WEPARTY REPLAY →
        </Link>
      )}

      <nav className="no-scrollbar my-4 flex gap-1 overflow-x-auto" role="tablist">
        {(
          [
            ["queue", dj ? `Booth${s.stats.pending ? ` (${s.stats.pending})` : ""}` : "Live queue"],
            ...(dj ? [["pulse", "Crowd Pulse"]] : []),
            ["dj", dj ? "DJ settings" : "DJ Mode"],
            ["guests", `Guests (${data.people.length})${data.reports.length ? ` · ⚠ ${new Set(data.reports.map((r) => r.guestId)).size}` : ""}`],
            ["settings", "Party shuffle settings"],
            ["share", "QR, details & export"],
            ["apple", "Apple Music & Offtrack"],
          ] as [Panel, string][]
        ).map(([p, label]) => (
          <button
            key={p}
            role="tab"
            aria-selected={panel === p}
            onClick={() => setPanel(p)}
            className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${panel === p ? "bg-white text-night" : "bg-white/5 text-muted hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {panel === "queue" && dj && (
        <DjBooth eventId={eventId} s={s} settings={data.settings} busy={busy} act={act} onStatus={(a) => status(a)} />
      )}
      {panel === "pulse" && dj && (
        <CrowdPulse eventId={eventId} version={`${s.stats.votes}:${s.stats.songs}:${s.stats.pending}`} act={act} />
      )}
      {panel === "dj" && (
        <DjModePanel eventId={eventId} settings={data.settings} blocks={data.blocks} djPhotoUrl={data.djPhotoUrl} sponsorEnabled={Boolean(data.features?.sponsor)} onSaved={refresh} />
      )}
      {panel === "queue" && !dj && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <NowPlayingHost s={s} busy={busy} ended={ended} act={act} />
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Up next · live queue</h2>
                <div className="flex gap-2">
                  {s.queue.some((q) => q.pinned) && (
                    <button className="text-xs text-muted underline hover:text-white" onClick={() => act({ type: "unpin_all" }, "Back to crowd order")}>
                      Unlock all (crowd decides)
                    </button>
                  )}
                  {!ended && <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setAdding(true)}>＋ Add song</button>}
                </div>
              </div>
              {s.queue.length === 0 ? (
                <p className="glass rounded-2xl p-6 text-center text-muted">The queue is empty. Guests&apos; picks will appear here.</p>
              ) : (
                <motion.ul layout className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {s.queue.map((song, idx) => (
                      <HostSongRow key={song.id} song={song} idx={idx} last={s.queue.length - 1} busy={busy} ended={ended} act={act} />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
              <p className="mt-3 text-xs text-muted">
                📌 Moving a song locks the songs above it in your order. Everything below stays crowd-ranked. Score = hearts + extra requests − fairness × the requester&apos;s turn.
              </p>
            </section>
            {data.hidden.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold tracking-[0.3em] text-muted uppercase">Skipped & removed</h2>
                <ul className="flex flex-col gap-1">
                  {data.hidden.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{h.title} <span className="text-muted">· {h.artist}</span></span>
                      <span className="text-xs text-muted">{h.status}</span>
                      {!ended && <button className="text-xs text-pink" onClick={() => act({ type: "restore", itemId: h.id }, "Song back in the queue")}>Restore</button>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside className="flex flex-col gap-4">
            <div className="glass rounded-3xl p-4">
              <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Played ({s.history.length})</h2>
              <ol className="mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto text-sm">
                {s.history.map((h) => (
                  <li key={h.id} className="flex gap-2">
                    <span className="w-6 text-right text-muted">{h.playOrder}</span>
                    <span className="min-w-0 flex-1 truncate">{h.title} <span className="text-muted">· {h.artist}</span></span>
                  </li>
                ))}
                {s.history.length === 0 && <li className="text-muted">Nothing played yet.</li>}
              </ol>
            </div>
            <div className="glass rounded-3xl p-4">
              <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Most popular</h2>
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {s.popular.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="text-pink">♥ {p.votes}</span>
                  </li>
                ))}
                {s.popular.length === 0 && <li className="text-muted">No hearts yet.</li>}
              </ol>
            </div>
            <ActivityLog log={data.log} people={data.people} />
          </aside>
        </div>
      )}

      {panel === "guests" && <GuestsPanel eventId={eventId} people={data.people} reports={data.reports} onChanged={refresh} />}
      {panel === "settings" && <SettingsPanel eventId={eventId} settings={data.settings} onSaved={refresh} />}
      {panel === "share" && <SharePanel eventId={eventId} code={code} joinUrl={joinUrl} initial={initial} />}
      {panel === "apple" && (
        <OfftrackPanel eventId={eventId} code={code} snapshot={s} livePlaylistId={data.liveApplePlaylistId} onChanged={refresh} />
      )}

      <AnimatePresence>
        {adding && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAdding(false)}
          >
            <motion.div
              className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-night-2 p-4 sm:rounded-3xl"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Add a song as host</h2>
                <button className="text-muted" onClick={() => setAdding(false)}>Close ✕</button>
              </div>
              <HostAdd eventId={eventId} existing={[...s.queue.map((q) => q.appleSongId), ...(s.nowPlaying ? [s.nowPlaying.appleSongId] : [])]} onAdded={refresh} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function ConfirmButton({ children, confirmLabel, onConfirm, className, disabled }: { children: React.ReactNode; confirmLabel: string; onConfirm: () => void; className: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

function NowPlayingHost({ s, busy, ended, act }: { s: QueueSnapshot; busy: boolean; ended: boolean; act: (b: Record<string, unknown>, m?: string) => void }) {
  const np = s.nowPlaying;
  const next = s.queue[0];
  return (
    <section className="relative overflow-hidden rounded-3xl p-4 sm:p-5">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pink/35 via-violet/25 to-cyan/15" />
      <p className="text-xs font-bold tracking-[0.3em] uppercase">Now playing</p>
      {np ? (
        <div className="mt-3 flex items-center gap-4">
          <Artwork src={np.artworkUrl} size={84} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold leading-tight">{np.title}</p>
            <p className="truncate text-white/80">{np.artist} {np.durationMs ? `· ${formatDuration(np.durationMs)}` : ""}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <Requester song={np} />
              <span className="text-xs text-pink">♥ {np.votes}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/80">Nothing is playing. Tap “Start next song” when the DJ plays the first track.</p>
      )}
      {!ended && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy || (!next && !np)} onClick={() => act({ type: "next" }, next ? `Now playing: ${next.title}` : "Marked as played")}>
            {np ? "⏭ Next song" : "▶ Start next song"}
          </button>
          {np && (
            <>
              <button className="btn btn-ghost" disabled={busy} onClick={() => act({ type: "finish_current" }, "Marked as played")}>✓ Mark played</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => act({ type: "skip", itemId: np.id }, "Skipped")}>Skip (don&apos;t count as played)</button>
            </>
          )}
        </div>
      )}
      {next && !ended && (
        <p className="mt-3 text-sm text-white/80">
          Up next: <b>{next.title}</b> · {next.artist}
        </p>
      )}
    </section>
  );
}

function HostSongRow({ song, idx, last, busy, ended, act }: { song: SongView; idx: number; last: number; busy: boolean; ended: boolean; act: (b: Record<string, unknown>, m?: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      className={`rounded-2xl ${song.pinned ? "bg-cyan/10 ring-1 ring-cyan/30" : "bg-white/[0.04]"}`}
    >
      <div className="flex items-center gap-3 p-2.5">
        <span className="w-7 text-center font-display text-sm font-bold text-muted">{song.pinned ? "📌" : ""}{song.position}</span>
        <Artwork src={song.artworkUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{song.title}{song.explicit && <span className="ml-1 rounded bg-white/15 px-1 text-[10px]">E</span>}</p>
          <p className="truncate text-sm text-muted">{song.artist}</p>
          <Requester song={song} compact />
        </div>
        <div className="text-right text-xs">
          <p className="font-bold text-pink">♥ {song.votes}</p>
          {song.requests > 1 && <p className="text-muted">{song.requests} requests</p>}
          {song.score !== null && <p className="text-muted">score {Math.round(song.score * 10) / 10}</p>}
        </div>
        {!ended && (
          <div className="flex flex-col gap-1">
            <button className="rounded-lg bg-white/5 px-2 text-sm disabled:opacity-30" disabled={busy || idx === 0} onClick={() => act({ type: "move", itemId: song.id, toIndex: idx - 1 })} aria-label="Move up">▲</button>
            <button className="rounded-lg bg-white/5 px-2 text-sm disabled:opacity-30" disabled={busy || idx === last} onClick={() => act({ type: "move", itemId: song.id, toIndex: idx + 1 })} aria-label="Move down">▼</button>
          </div>
        )}
        {!ended && (
          <button className="rounded-lg px-2 py-1 text-lg text-muted hover:text-white" onClick={() => setOpen((o) => !o)} aria-label="More actions" aria-expanded={open}>⋯</button>
        )}
      </div>
      {open && !ended && (
        <div className="flex flex-wrap gap-2 border-t border-white/5 p-2.5">
          <button className="btn btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={() => act({ type: "play_now", itemId: song.id }, `Now playing: ${song.title}`)}>▶ Play now</button>
          <button className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => act({ type: "move", itemId: song.id, toIndex: 0 }, "Moved to the top")}>⤒ Play next</button>
          {song.pinned && <button className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => act({ type: "unpin", itemId: song.id }, "Unlocked")}>Unlock</button>}
          <button className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => act({ type: "skip", itemId: song.id }, "Skipped")}>Skip</button>
          <button className="btn btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => act({ type: "remove", itemId: song.id }, "Removed")}>Remove</button>
          {song.appleUrl && <a className="btn btn-ghost px-3 py-1.5 text-xs" href={song.appleUrl} target="_blank" rel="noopener noreferrer">Apple Music ↗</a>}
        </div>
      )}
    </motion.li>
  );
}

function HostAdd({ eventId, existing, onAdded }: { eventId: string; existing: string[]; onAdded: () => void }) {
  const toast = useToast();
  const [added, setAdded] = useState<string[]>([]);
  const sel = new Map<string, Song>();
  return (
    <SongBrowser
      selected={sel}
      lockedIds={[...existing, ...added]}
      lockedLabel="In queue"
      onToggle={async (song) => {
        try {
          await apiFetch(`/api/host/events/${eventId}/songs`, { method: "POST", json: { song } });
          setAdded((a) => [...a, song.appleId]);
          toast(`Added ${song.title}`, "success");
          onAdded();
        } catch (e) {
          toast((e as Error).message, "error");
        }
      }}
    />
  );
}

function GuestsPanel({ eventId, people, reports, onChanged }: { eventId: string; people: HostState["people"]; reports: HostState["reports"]; onChanged: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const reported = new Map<string, string[]>();
  for (const r of reports) reported.set(r.guestId, [...(reported.get(r.guestId) ?? []), r.reason]);
  const list = people
    .filter((p) => !q || `${p.displayName} ${p.instagram}`.toLowerCase().includes(q.toLowerCase().replace(/^@/, "")))
    .sort((a, b) => (reported.get(b.id)?.length ?? 0) - (reported.get(a.id)?.length ?? 0));
  const remove = async (id: string, ig: string) => {
    try {
      await apiFetch(`/api/host/events/${eventId}/guests/${id}`, { method: "DELETE" });
      toast(`Removed @${ig}. They can join again with a fresh profile.`, "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <section className="flex flex-col gap-3">
      <input className="field max-w-md" placeholder="Search guests" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      <div className="overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-white/5 text-left text-xs tracking-wider text-muted uppercase">
            <tr>
              <th className="p-3">Guest</th>
              <th className="p-3">Instagram</th>
              <th className="p-3">Songs</th>
              <th className="p-3">Hearts received</th>
              <th className="p-3">Joined</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3">
                  <span className="flex items-center gap-2"><Avatar person={p} size={32} />{p.displayName}</span>
                  {reported.has(p.id) && (
                    <span className="mt-1 block text-xs text-rose-300" title={reported.get(p.id)!.join("\n")}>
                      ⚠ Reported {reported.get(p.id)!.length}×: {reported.get(p.id)![0]}
                    </span>
                  )}
                </td>
                <td className="p-3"><InstagramLink username={p.instagram} /></td>
                <td className="p-3">{p.songs.length}</td>
                <td className="p-3">{p.heartsReceived}</td>
                <td className="p-3 text-muted">{new Date(p.joinedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                <td className="p-3 text-right">
                  <ConfirmButton className="text-xs text-rose-300 hover:underline" confirmLabel="Confirm remove" onConfirm={() => remove(p.id, p.instagram)}>
                    Remove / reset
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted">No guests yet. Share the QR code!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsPanel({ eventId, settings, onSaved }: { eventId: string; settings: PartySettings; onSaved: () => void }) {
  const toast = useToast();
  const [s, setS] = useState(settings);
  const save = async () => {
    try {
      const res = await apiFetch<{ settings: PartySettings }>(`/api/host/events/${eventId}/settings`, { method: "PATCH", json: s });
      setS(res.settings);
      toast("Settings saved. The queue re-ranked.", "success");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const num = (k: keyof PartySettings, label: string, help: string, min: number, max: number, step = 1) => (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-sm font-semibold">{label}<span className="font-display text-pink">{String(s[k])}</span></span>
      <input type="range" min={min} max={max} step={step} value={Number(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} className="accent-pink-500" />
      <span className="text-xs text-muted">{help}</span>
    </label>
  );
  const bool = (k: keyof PartySettings, label: string, help: string) => (
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={Boolean(s[k])} onChange={(e) => setS({ ...s, [k]: e.target.checked })} className="mt-1 h-5 w-5 accent-pink-500" />
      <span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-muted">{help}</span></span>
    </label>
  );
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="glass flex flex-col gap-5 rounded-3xl p-5">
        <h2 className="font-display text-lg font-bold">Party Shuffle</h2>
        {num("heartWeight", "Heart power", "How much each heart moves a song up.", 0, 5, 0.5)}
        {num("requestWeight", "Extra-request power", "Bonus when several guests pick the same song.", 0, 5, 0.5)}
        {num("fairness", "Fair rotation", "Higher = everyone's first song plays before anyone's second. 0 = pure popularity.", 0, 10, 0.5)}
        {bool("noBackToBack", "No back-to-back from the same guest", "Mixes up requesters when possible.")}
      </div>
      <div className="glass flex flex-col gap-5 rounded-3xl p-5">
        <h2 className="font-display text-lg font-bold">Guest rules</h2>
        {num("minPicks", "Songs needed to join", "Guests pick at least this many on their first go. 1 is fastest.", 1, 10)}
        {num("maxPicks", "Maximum songs per guest", "Total songs one guest can add.", 1, 25)}
        {bool("allowExplicit", "Allow explicit songs", "Turn off for a clean party.")}
        {bool("replayShowPeople", "Show guests on the public replay page", "Names and Instagram handles next to songs on the shareable replay.")}
        <button className="btn btn-primary mt-auto" onClick={save}>Save settings</button>
      </div>
    </section>
  );
}

function SharePanel({ eventId, code, joinUrl, initial }: { eventId: string; code: string; joinUrl: string; initial: Details }) {
  const toast = useToast();
  const router = useRouter();
  const [d, setD] = useState({ ...initial, startsAt: initial.startsAt ? toLocalInput(initial.startsAt) : "" });
  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  const save = async () => {
    try {
      await apiFetch(`/api/host/events/${eventId}`, {
        method: "PATCH",
        json: { ...d, startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null, replayAppleUrl: d.replayAppleUrl || null },
      });
      toast("Event saved", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/host/events/${eventId}/qr?format=png`} alt="Event QR code" className="w-56 rounded-2xl bg-white p-2" />
        <p className="font-mono text-sm break-all">{joinUrl}</p>
        <p className="text-xs text-muted">Party code: <b className="font-mono text-white uppercase">{code}</b></p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/host/events/${eventId}/poster`} className="btn btn-primary px-4 py-2 text-sm">Printable poster</Link>
          <a href={`/api/host/events/${eventId}/qr?format=png`} className="btn btn-ghost px-4 py-2 text-sm">Download PNG</a>
          <a href={`/api/host/events/${eventId}/qr?format=svg`} className="btn btn-ghost px-4 py-2 text-sm">Download SVG</a>
          <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => navigator.clipboard.writeText(joinUrl).then(() => toast("Link copied"))}>Copy link</button>
          <button
            className="btn btn-ghost px-4 py-2 text-sm"
            onClick={async () => {
              const r = await shareLink({ title: `Join ${d.name} on We Party`, text: `Pick songs and vote on the music at ${d.name} 🎶`, url: joinUrl });
              if (r === "copied") toast("Link copied");
            }}
          >
            Share invite
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <div className="glass flex flex-col gap-3 rounded-3xl p-5">
          <h2 className="font-display text-lg font-bold">Event details</h2>
          <input className="field" value={d.name} onChange={set("name")} placeholder="Event name" />
          <input className="field" value={d.venueName} onChange={set("venueName")} placeholder="Venue" />
          <input className="field" type="datetime-local" value={d.startsAt} onChange={set("startsAt")} />
          <textarea className="field min-h-20" value={d.description} onChange={set("description")} placeholder="Note for guests" />
          <label className="text-xs text-muted">
            Public Apple Music playlist link (optional, shown on the replay page)
            <input className="field mt-1" value={d.replayAppleUrl} onChange={set("replayAppleUrl")} placeholder="https://music.apple.com/…" />
          </label>
          <button className="btn btn-primary" onClick={save}>Save details</button>
        </div>
        <div className="glass flex flex-col gap-3 rounded-3xl p-5">
          <h2 className="font-display text-lg font-bold">Export</h2>
          <p className="text-sm text-muted">Download the queue or what actually played. The .txt list works with playlist-transfer tools.</p>
          <div className="flex flex-wrap gap-2">
            {[
              ["queue", "csv", "Upcoming queue (.csv)"],
              ["queue", "txt", "Upcoming queue (.txt)"],
              ["played", "csv", "Played songs (.csv)"],
              ["played", "txt", "Played songs (.txt)"],
              ["played", "json", "Played songs (.json)"],
            ].map(([list, format, label]) => (
              <a key={label} href={`/api/host/events/${eventId}/export?list=${list}&format=${format}`} className="btn btn-ghost px-3 py-2 text-xs">{label}</a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ACTION_LABELS: Record<string, string> = {
  guest_joined: "joined",
  songs_submitted: "added songs",
  queue_next: "started the next song",
  queue_play_now: "played a song now",
  queue_finish_current: "marked a song played",
  queue_skip: "skipped a song",
  queue_remove: "removed a song",
  queue_restore: "restored a song",
  queue_move: "reordered the queue",
  queue_unpin: "unlocked a song",
  queue_unpin_all: "unlocked the queue",
  submissions_paused: "paused requests",
  submissions_resumed: "resumed requests",
  event_ended: "ended the event",
  event_reopened: "reopened the event",
  event_created: "created the event",
  settings_changed: "changed settings",
  host_added_song: "added a song",
  guest_removed: "removed a guest",
};

function ActivityLog({ log, people }: { log: HostState["log"]; people: HostState["people"] }) {
  const who = (actor: string) => {
    if (actor.startsWith("host:")) return "Host";
    const p = people.find((x) => `guest:${x.id}` === actor);
    return p ? `@${p.instagram}` : "A guest";
  };
  return (
    <div className="glass rounded-3xl p-4">
      <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Activity</h2>
      <ul className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto text-xs">
        {log.map((l) => (
          <li key={l.id} className="flex gap-2">
            <span className="shrink-0 text-muted">{new Date(l.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            <span>
              <b>{who(l.actor)}</b> {ACTION_LABELS[l.action] ?? l.action}
              {typeof l.details?.title === "string" ? `: ${l.details.title}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
