"use client";
/* eslint-disable @next/next/no-img-element */
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useEffect, useState } from "react";
import { Artwork } from "@/components/Artwork";
import { Requester } from "@/components/SongCard";
import { SongBrowser } from "@/components/SongBrowser";
import { useToast } from "@/components/Toast";
import { apiFetch, resizeImage } from "@/lib/client";
import { hapticTap } from "@/lib/native";
import type { PartySettings } from "@/lib/ranking";
import type { QueueSnapshot, SongView } from "@/lib/types";

type Act = (body: Record<string, unknown>, msg?: string) => Promise<void> | void;
export type Block = { id: string; kind: "song" | "artist"; value: string; label: string; createdAt: string };

/* ------------------------------------------------------------------------ */
/* DJ Booth: the live queue, built for one thumb in a dark room              */
/* ------------------------------------------------------------------------ */

export function DjBooth({
  eventId,
  s,
  settings,
  busy,
  act,
  onStatus,
}: {
  eventId: string;
  s: QueueSnapshot;
  settings: PartySettings;
  busy: boolean;
  act: Act;
  onStatus: (action: "pause" | "resume") => void;
}) {
  const [sheet, setSheet] = useState<SongView | null>(null);
  const [shout, setShout] = useState(false);
  const np = s.nowPlaying;
  const next = s.queue[0];
  const ended = s.event.status === "ended";

  return (
    <div className="flex flex-col gap-5 pb-40">
      <section className="rounded-3xl border border-white/15 bg-black p-4">
        <p className="text-xs font-black tracking-[0.3em] text-lime uppercase">Now playing</p>
        {np ? (
          <div className="mt-3 flex items-center gap-4">
            <Artwork src={np.artworkUrl} size={72} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-black leading-tight text-white">{np.title}</p>
              <p className="truncate text-base text-white/80">{np.artist}</p>
              <p className="mt-1 text-sm text-pink">♥ {np.votes}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-base text-white/80">Nothing playing. Tap START when the first track drops.</p>
        )}
        {next && (
          <p className="mt-3 truncate text-sm text-white/70">
            Next: <b className="text-white">{next.title}</b> · {next.artist}
          </p>
        )}
      </section>

      {s.pending.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black tracking-[0.2em] text-cyan uppercase">Pending · {s.pending.length}</h2>
            <button className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-bold text-white" disabled={busy} onClick={() => act({ type: "approve_all" }, "All requests approved")}>
              Approve all
            </button>
          </div>
          <p className="mb-2 text-xs text-white/60">Swipe right to approve, left to decline. Or tap the buttons.</p>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {s.pending.map((p) => (
                <PendingCard key={p.id} song={p} busy={busy} act={act} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-black tracking-[0.2em] text-white uppercase">Up next · {s.queue.length}</h2>
          {settings.lockCount > 0 && <span className="text-xs font-bold text-lime">🔒 Next {settings.lockCount} locked</span>}
        </div>
        {s.queue.length === 0 ? (
          <p className="rounded-2xl border border-white/15 p-6 text-center text-white/70">
            {s.pending.length ? "Approve some requests to fill the queue." : "No requests yet. Guests' picks land here."}
          </p>
        ) : (
          <motion.ul layout className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {s.queue.map((song, idx) => (
                <motion.li
                  layout
                  key={song.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-3 rounded-2xl p-2.5 ${song.locked ? "bg-lime/10 ring-1 ring-lime/40" : "bg-white/[0.06]"}`}
                >
                  <span className="w-8 text-center text-lg font-black text-white/70">{song.locked ? "🔒" : idx + 1}</span>
                  <Artwork src={song.artworkUrl} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-white">
                      {song.title}
                      {song.explicit && <span className="ml-1 rounded bg-white/20 px-1 text-[10px] align-middle">E</span>}
                    </p>
                    <p className="truncate text-sm text-white/70">{song.artist}</p>
                    <p className="text-xs text-pink">♥ {song.votes}{song.requests > 1 ? ` · ${song.requests} requests` : ""}</p>
                  </div>
                  {!ended && (
                    <>
                      <button
                        className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-xl text-white disabled:opacity-30"
                        disabled={busy || idx === 0}
                        onClick={() => act({ type: "move", itemId: song.id, toIndex: idx - 1 })}
                        aria-label={`Move ${song.title} up`}
                      >
                        ▲
                      </button>
                      <button
                        className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-2xl text-white"
                        onClick={() => setSheet(song)}
                        aria-label={`More for ${song.title}`}
                      >
                        ⋯
                      </button>
                    </>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
        {s.queue.some((q) => q.pinned && !q.locked) && (
          <button className="mt-3 min-h-11 text-sm text-white/70 underline" onClick={() => act({ type: "unpin_all" }, "Back to crowd order")}>
            Unlock my manual order (crowd decides)
          </button>
        )}
      </section>

      {/* Thumb bar: the buttons a DJ needs all night, at the bottom of the screen. */}
      {!ended && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/15 bg-black/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-xl gap-2">
            <button
              className="min-h-14 flex-1 rounded-2xl bg-lime px-4 text-lg font-black text-black active:scale-[0.98] disabled:opacity-40"
              disabled={busy || (!next && !np)}
              onClick={() => {
                hapticTap(true);
                act({ type: "next" }, next ? `Now playing: ${next.title}` : "Marked as played");
              }}
            >
              {np ? "⏭ NEXT SONG" : "▶ START"}
            </button>
            <button className="min-h-14 rounded-2xl bg-cyan px-4 text-base font-black text-black" onClick={() => setShout(true)} aria-label="Send a shoutout">
              📣
            </button>
            <button
              className={`min-h-14 rounded-2xl px-4 text-base font-black ${s.event.submissionsOpen ? "bg-white/15 text-white" : "bg-amber-400 text-black"}`}
              onClick={() => onStatus(s.event.submissionsOpen ? "pause" : "resume")}
              disabled={busy}
              aria-label={s.event.submissionsOpen ? "Pause requests" : "Resume requests"}
            >
              {s.event.submissionsOpen ? "⏸ PAUSE" : "▶ OPEN"}
            </button>
          </div>
        </div>
      )}

      <SongSheet song={sheet} onClose={() => setSheet(null)} eventId={eventId} busy={busy} act={act} np={np} />
      <ShoutoutSheet open={shout} onClose={() => setShout(false)} eventId={eventId} current={s.shoutout?.message ?? null} />
    </div>
  );
}

function PendingCard({ song, busy, act }: { song: SongView; busy: boolean; act: Act }) {
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110) {
      hapticTap();
      act({ type: "approve", itemId: song.id }, `Approved: ${song.title}`);
    } else if (info.offset.x < -110) {
      hapticTap();
      act({ type: "decline", itemId: song.id }, `Declined: ${song.title}`);
    }
  };
  return (
    <motion.li
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 0, scale: 0.95 }}
      className="flex touch-pan-y items-center gap-3 rounded-2xl border border-cyan/40 bg-black p-2.5"
    >
      <Artwork src={song.artworkUrl} size={52} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-white">
          {song.title}
          {song.explicit && <span className="ml-1 rounded bg-white/20 px-1 text-[10px] align-middle">E</span>}
        </p>
        <p className="truncate text-sm text-white/70">{song.artist}</p>
        <Requester song={song} compact />
      </div>
      <button
        className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-500 text-2xl font-black text-white"
        disabled={busy}
        onClick={() => act({ type: "decline", itemId: song.id }, `Declined: ${song.title}`)}
        aria-label={`Decline ${song.title}`}
      >
        ✕
      </button>
      <button
        className="grid h-14 w-14 place-items-center rounded-2xl bg-lime text-2xl font-black text-black"
        disabled={busy}
        onClick={() => act({ type: "approve", itemId: song.id }, `Approved: ${song.title}`)}
        aria-label={`Approve ${song.title}`}
      >
        ✓
      </button>
    </motion.li>
  );
}

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-label={title}
            className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#0b0a12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="truncate text-lg font-black text-white">{title}</h2>
              <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SongSheet({ song, onClose, eventId, busy, act, np }: { song: SongView | null; onClose: () => void; eventId: string; busy: boolean; act: Act; np: SongView | null }) {
  const toast = useToast();
  const run = async (body: Record<string, unknown>, msg: string) => {
    await act(body, msg);
    onClose();
  };
  const block = async (kind: "song" | "artist") => {
    if (!song) return;
    try {
      const r = await apiFetch<{ removed: number }>(`/api/host/events/${eventId}/blocklist`, {
        method: "POST",
        json: kind === "song" ? { kind, value: song.appleSongId, label: `${song.title} · ${song.artist}` } : { kind, value: song.artist, label: song.artist },
      });
      toast(`Blocked ${kind === "song" ? "that song" : song.artist}. ${r.removed} removed from the queue.`, "success");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const big = "min-h-14 w-full rounded-2xl px-4 text-left text-base font-bold";
  return (
    <Sheet open={Boolean(song)} onClose={onClose} title={song ? song.title : ""}>
      {song && (
        <div className="flex flex-col gap-2">
          <p className="-mt-2 mb-2 text-sm text-white/70">{song.artist}</p>
          <button className={`${big} bg-lime text-black`} disabled={busy} onClick={() => run({ type: "play_now", itemId: song.id }, `Now playing: ${song.title}`)}>
            ▶ Play now{np ? " (ends the current song)" : ""}
          </button>
          <button className={`${big} bg-white/10 text-white`} disabled={busy} onClick={() => run({ type: "move", itemId: song.id, toIndex: 0 }, "Moved to the top")}>
            ⤒ Play next
          </button>
          {song.pinned && (
            <button className={`${big} bg-white/10 text-white`} disabled={busy} onClick={() => run({ type: "unpin", itemId: song.id }, "Unlocked")}>
              🔓 Let the crowd move it
            </button>
          )}
          <button className={`${big} bg-white/10 text-white`} disabled={busy} onClick={() => run({ type: "skip", itemId: song.id }, "Skipped")}>
            ⏭ Skip
          </button>
          <button className={`${big} bg-rose-500/90 text-white`} disabled={busy} onClick={() => run({ type: "remove", itemId: song.id }, "Removed")}>
            ✕ Remove from queue
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="min-h-14 rounded-2xl border border-rose-400/60 px-3 text-sm font-bold text-rose-200" onClick={() => block("song")}>
              🚫 Block song
            </button>
            <button className="min-h-14 rounded-2xl border border-rose-400/60 px-3 text-sm font-bold text-rose-200" onClick={() => block("artist")}>
              🚫 Block artist
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

const SHOUT_PRESETS = ["Last call for requests! 🎶", "Who's ready for the next one? 🔥", "Heart your favorites to move them up ❤️", "Thank you for coming tonight! 🙏"];

function ShoutoutSheet({ open, onClose, eventId, current }: { open: boolean; onClose: () => void; eventId: string; current: string | null }) {
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const send = async (message: string) => {
    try {
      await apiFetch(`/api/host/events/${eventId}/shoutout`, { method: "POST", json: { message } });
      toast("Shoutout sent to every guest", "success");
      setMsg("");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const clear = async () => {
    try {
      await apiFetch(`/api/host/events/${eventId}/shoutout`, { method: "DELETE" });
      toast("Shoutout cleared");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="📣 Shoutout to every guest">
      <div className="flex flex-col gap-2">
        {current && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-white/5 p-3 text-sm text-white/80">
            <span className="min-w-0 flex-1">Showing now: “{current}”</span>
            <button className="min-h-11 rounded-xl px-3 text-rose-200 underline" onClick={clear}>
              Clear
            </button>
          </div>
        )}
        {SHOUT_PRESETS.map((p) => (
          <button key={p} className="min-h-14 rounded-2xl bg-white/10 px-4 text-left text-base font-semibold text-white" onClick={() => send(p)}>
            {p}
          </button>
        ))}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (msg.trim()) send(msg);
          }}
        >
          <input className="field" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Or write your own (140 max)" maxLength={140} aria-label="Shoutout message" />
          <button className="min-h-12 rounded-2xl bg-cyan px-4 font-black text-black" disabled={!msg.trim()}>
            Send
          </button>
        </form>
        <p className="text-xs text-white/50">Shows at the top of every guest&apos;s screen for 15 minutes.</p>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------------ */
/* DJ Mode settings: Spotlight, approval, lock, explicit filter, blocklist   */
/* ------------------------------------------------------------------------ */

export function DjModePanel({
  eventId,
  settings,
  blocks,
  djPhotoUrl,
  onSaved,
}: {
  eventId: string;
  settings: PartySettings;
  blocks: Block[];
  djPhotoUrl: string | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(settings.djName);
  const [ig, setIg] = useState(settings.djInstagram);
  useEffect(() => {
    setName(settings.djName);
    setIg(settings.djInstagram);
  }, [settings.djName, settings.djInstagram]);

  const save = async (patch: Partial<PartySettings>, msg = "Saved") => {
    try {
      await apiFetch(`/api/host/events/${eventId}/settings`, { method: "PATCH", json: patch });
      toast(msg, "success");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await resizeImage(file);
      const res = await fetch(`/api/host/events/${eventId}/dj-photo`, { method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" } });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      toast("DJ photo updated", "success");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const Toggle = ({ on, label, help, onChange }: { on: boolean; label: string; help: string; onChange: (v: boolean) => void }) => (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-14 w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-white">{label}</span>
        <span className="text-sm text-white/60">{help}</span>
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? "bg-lime" : "bg-white/20"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Toggle
          on={settings.djMode}
          label="DJ Mode"
          help="Turns the control room into the DJ Booth and shows the DJ on guest screens. The DJ stays in control."
          onChange={(v) => save({ djMode: v }, v ? "DJ Mode on" : "DJ Mode off")}
        />
        {settings.djMode && (
          <>
            <Toggle
              on={settings.approvalMode}
              label="Approve requests first"
              help="New requests wait in Pending. Only songs you approve enter the queue."
              onChange={(v) => save({ approvalMode: v }, v ? "Approval mode on" : "Approval mode off: pending songs joined the queue")}
            />
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-base font-bold text-white">Lock the next songs</p>
              <p className="text-sm text-white/60">Hearts can&apos;t move locked songs. They only reorder what comes after.</p>
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`min-h-12 rounded-xl text-lg font-black ${settings.lockCount === n ? "bg-lime text-black" : "bg-white/10 text-white"}`}
                    onClick={() => save({ lockCount: n }, n ? `Next ${n} locked` : "Lock off")}
                    aria-pressed={settings.lockCount === n}
                  >
                    {n === 0 ? "Off" : n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <Toggle
          on={!settings.allowExplicit}
          label="Filter explicit tracks"
          help="Blocks explicit requests and takes explicit songs out of the queue."
          onChange={(v) => save({ allowExplicit: !v }, v ? "Clean-only: explicit songs removed" : "Explicit songs allowed")}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-base font-bold text-white">DJ Spotlight</p>
          <p className="text-sm text-white/60">Guests see “DJ ___ is spinning” with your photo and Instagram, here and on the replay.</p>
          <div className="mt-3 flex items-center gap-3">
            <label className="relative grid h-16 w-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-white/10 text-2xl" aria-label="Upload DJ photo">
              {djPhotoUrl ? <img src={djPhotoUrl} alt="DJ photo" className="h-full w-full object-cover" /> : "🎧"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
            </label>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input className="field py-2.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="DJ name" maxLength={60} aria-label="DJ name" />
              <input className="field py-2.5" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@instagram" autoCapitalize="none" aria-label="DJ Instagram" />
            </div>
          </div>
          <button className="btn btn-primary mt-3 w-full" onClick={() => save({ djName: name, djInstagram: ig }, "Spotlight saved")}>
            Save Spotlight
          </button>
        </div>
        <BlocklistEditor eventId={eventId} blocks={blocks} onChanged={onSaved} />
      </div>
    </section>
  );
}

function BlocklistEditor({ eventId, blocks, onChanged }: { eventId: string; blocks: Block[]; onChanged: () => void }) {
  const toast = useToast();
  const [artist, setArtist] = useState("");
  const [findSong, setFindSong] = useState(false);
  const add = async (body: Record<string, unknown>) => {
    try {
      const r = await apiFetch<{ removed: number }>(`/api/host/events/${eventId}/blocklist`, { method: "POST", json: body });
      toast(`Blocked. ${r.removed} song${r.removed === 1 ? "" : "s"} removed from the queue.`, "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/host/events/${eventId}/blocklist?blockId=${id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-base font-bold text-white">Blocklist</p>
      <p className="text-sm text-white/60">Guests can&apos;t request these. Blocking an artist also catches their features.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (artist.trim()) add({ kind: "artist", value: artist, label: artist.trim() }).then(() => setArtist(""));
        }}
      >
        <input className="field py-2.5" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist name" aria-label="Artist to block" />
        <button className="min-h-12 rounded-2xl bg-rose-500 px-4 font-bold text-white" disabled={!artist.trim()}>
          Block
        </button>
      </form>
      <button className="mt-2 min-h-11 text-sm text-white/70 underline" onClick={() => setFindSong((f) => !f)}>
        {findSong ? "Done blocking songs" : "Block a specific song…"}
      </button>
      {findSong && (
        <div className="mt-2">
          <SongBrowser
            selected={new Map()}
            lockedIds={blocks.filter((b) => b.kind === "song").map((b) => b.value)}
            lockedLabel="Blocked"
            onToggle={(song) => add({ kind: "song", value: song.appleId, label: `${song.title} · ${song.artist}` })}
          />
        </div>
      )}
      <ul className="mt-3 flex flex-col gap-1.5">
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-sm text-white">
            <span className="text-xs text-white/50">{b.kind === "artist" ? "Artist" : "Song"}</span>
            <span className="min-w-0 flex-1 truncate">{b.label}</span>
            <button className="min-h-11 px-2 text-xs text-white/70 underline" onClick={() => remove(b.id)}>
              Unblock
            </button>
          </li>
        ))}
        {blocks.length === 0 && <li className="text-sm text-white/50">Nothing blocked.</li>}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Crowd Pulse: suggestions only. The DJ decides.                            */
/* ------------------------------------------------------------------------ */

type Pulse = {
  trending: { id: string; title: string; artist: string; artworkUrl: string | null; status: string; recentHearts: number; recentRequests: number }[];
  topArtists: { artist: string; hearts: number; requests: number }[];
  genres: { genre: string; requests: number }[];
  activity: { at: string; requests: number; hearts: number }[];
};

export function CrowdPulse({ eventId, version, act }: { eventId: string; version: string; act: Act }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    apiFetch<Pulse>(`/api/host/events/${eventId}/pulse`)
      .then((p) => live && (setPulse(p), setErr(null)))
      .catch((e) => live && setErr((e as Error).message));
    return () => {
      live = false;
    };
  }, [eventId, version]);
  if (!pulse) return <p className="py-10 text-center text-white/60">{err ?? "Reading the crowd…"}</p>;
  const maxAct = Math.max(1, ...pulse.activity.map((a) => a.requests + a.hearts));
  const maxGenre = Math.max(1, ...pulse.genres.map((g) => g.requests));
  const card = "rounded-3xl border border-white/10 bg-black/40 p-4";
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <p className="text-sm text-white/60 lg:col-span-2">Suggestions from what the crowd is requesting and hearting. You decide what plays.</p>
      <div className={card}>
        <h3 className="text-sm font-black tracking-[0.2em] text-white uppercase">Trending now (30 min)</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {pulse.trending.map((t) => (
            <li key={t.id} className="flex items-center gap-3">
              <Artwork src={t.artworkUrl} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-white">{t.title}</span>
                <span className="block truncate text-xs text-white/60">
                  {t.artist} · ♥ {t.recentHearts} · {t.recentRequests} req{t.status === "pending" ? " · pending" : ""}
                </span>
              </span>
              {t.status === "queued" && (
                <button className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-bold text-white" onClick={() => act({ type: "move", itemId: t.id, toIndex: 0 }, `${t.title} plays next`)}>
                  Play next
                </button>
              )}
              {t.status === "pending" && (
                <button className="min-h-11 rounded-xl bg-lime px-3 text-sm font-bold text-black" onClick={() => act({ type: "approve", itemId: t.id }, `Approved: ${t.title}`)}>
                  Approve
                </button>
              )}
            </li>
          ))}
          {pulse.trending.length === 0 && <li className="text-sm text-white/50">Nothing trending yet.</li>}
        </ul>
      </div>
      <div className={card}>
        <h3 className="text-sm font-black tracking-[0.2em] text-white uppercase">Most-hearted artists</h3>
        <ol className="mt-3 flex flex-col gap-1.5">
          {pulse.topArtists.map((a, i) => (
            <li key={a.artist} className="flex items-center gap-3 text-white">
              <span className="w-5 text-right text-white/50">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{a.artist}</span>
              <span className="text-sm text-pink">♥ {a.hearts}</span>
              <span className="w-14 text-right text-xs text-white/60">{a.requests} req</span>
            </li>
          ))}
          {pulse.topArtists.length === 0 && <li className="text-sm text-white/50">No requests yet.</li>}
        </ol>
      </div>
      <div className={card}>
        <h3 className="text-sm font-black tracking-[0.2em] text-white uppercase">Genres requested</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {pulse.genres.map((g) => (
            <li key={g.genre} className="text-sm text-white">
              <div className="flex justify-between">
                <span>{g.genre}</span>
                <span className="text-white/60">{g.requests}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-cyan" style={{ width: `${(g.requests / maxGenre) * 100}%` }} />
              </div>
            </li>
          ))}
          {pulse.genres.length === 0 && <li className="text-sm text-white/50">Genres show up as requests come in.</li>}
        </ul>
      </div>
      <div className={card}>
        <h3 className="text-sm font-black tracking-[0.2em] text-white uppercase">Request activity (5-min blocks)</h3>
        {pulse.activity.length === 0 ? (
          <p className="mt-3 text-sm text-white/50">No activity in the last 2 hours.</p>
        ) : (
          <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label="Requests and hearts over the last two hours">
            {pulse.activity.map((a) => (
              <div key={a.at} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${a.requests} requests, ${a.hearts} hearts`}>
                <div className="w-full rounded-t bg-pink/80" style={{ height: `${(a.hearts / maxAct) * 100}%` }} />
                <div className="w-full bg-cyan" style={{ height: `${(a.requests / maxAct) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-white/50">
          <span className="text-cyan">■</span> requests <span className="ml-2 text-pink">■</span> hearts
        </p>
      </div>
    </section>
  );
}
