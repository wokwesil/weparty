"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Artwork } from "@/components/Artwork";
import { Avatar, InstagramLink } from "@/components/Avatar";
import { Backdrop, Equalizer, Wordmark } from "@/components/Brand";
import { NowPlaying, SongCard } from "@/components/SongCard";
import { ToastProvider, useToast } from "@/components/Toast";
import { apiFetch, resizeImage } from "@/lib/client";
import { hapticTap, shareLink } from "@/lib/native";
import type { GuestMe, QueueSnapshot, SongView } from "@/lib/types";
import { useLiveData } from "@/lib/useLive";

type State = QueueSnapshot & { me: GuestMe | null };
type Person = {
  id: string;
  displayName: string;
  instagram: string;
  avatarUrl: string | null;
  joinedAt: string;
  heartsReceived: number;
  songs: { id: string; title: string; artist: string; artworkUrl: string | null; status: string }[];
};
type Tab = "queue" | "popular" | "people" | "me";

export function PartyRoom(props: { code: string; eventId: string }) {
  return (
    <ToastProvider>
      <Room {...props} />
    </ToastProvider>
  );
}

function Room({ code, eventId }: { code: string; eventId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("queue");
  const { data, setData, refresh, connected } = useLiveData<State>(`/api/e/${code}/state`, eventId, {
    onUnauthorized: () => router.replace(`/e/${code}/join`),
  });

  const added = search.get("added");
  const shown = useRef(false);
  useEffect(() => {
    if (added && !shown.current) {
      shown.current = true;
      toast(`🎉 ${added} song${added === "1" ? "" : "s"} added to the party!`, "success");
      router.replace(`/e/${code}/party`);
    }
  }, [added, code, router, toast]);

  const voted = useMemo(() => new Set(data?.me?.votedIds ?? []), [data?.me?.votedIds]);
  const mine = useMemo(() => new Set(data?.me?.mySongIds ?? []), [data?.me?.mySongIds]);
  const ended = data?.event.status === "ended";

  const vote = async (song: SongView, on: boolean) => {
    if (!data?.me) return;
    // Show the heart instantly, then confirm with the server.
    const patch = (d: State, delta: number, nowVoted: boolean): State => {
      const bump = (s: SongView) => (s.id === song.id ? { ...s, votes: Math.max(0, s.votes + delta) } : s);
      const ids = new Set(d.me!.votedIds);
      if (nowVoted) ids.add(song.id);
      else ids.delete(song.id);
      return {
        ...d,
        nowPlaying: d.nowPlaying ? bump(d.nowPlaying) : null,
        queue: d.queue.map(bump),
        popular: d.popular.map(bump),
        history: d.history.map(bump),
        me: { ...d.me!, votedIds: [...ids] },
      };
    };
    setData((d) => (d ? patch(d, on ? 1 : -1, on) : d));
    if (on) hapticTap();
    try {
      await apiFetch(`/api/e/${code}/votes`, { method: "POST", json: { itemId: song.id, on } });
    } catch (e) {
      toast((e as Error).message, "error");
      setData((d) => (d ? patch(d, on ? -1 : 1, !on) : d));
    }
    refresh();
  };

  if (!data) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <Backdrop />
        <Equalizer className="h-10" bars={6} />
      </main>
    );
  }

  const upNext = data.queue[0] ?? null;
  const rest = data.queue.slice(1);

  return (
    <main className="relative mx-auto min-h-dvh max-w-xl px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Backdrop />
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-night/70 px-4 py-3 backdrop-blur-xl">
        <Wordmark size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-right text-sm font-semibold">{data.event.name}</p>
          <p className="flex items-center justify-end gap-1.5 text-[11px] text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-lime" : "bg-amber-400"}`} />
            {data.stats.guests} here · {data.stats.votes} hearts
          </p>
        </div>
        {data.me && (
          <button onClick={() => setTab("me")} aria-label="My profile">
            <Avatar person={data.me} size={34} ring />
          </button>
        )}
      </header>

      {ended && (
        <Link href={`/e/${code}/replay`} className="mb-4 block rounded-2xl bg-brand p-4 text-center font-bold">
          🎧 The party&apos;s over. Get YOUR WEPARTY REPLAY →
        </Link>
      )}
      {!ended && !data.event.submissionsOpen && (
        <p className="mb-4 rounded-2xl bg-amber-500/15 px-4 py-2.5 text-center text-sm text-amber-100">Song requests are paused by the host. Keep the hearts coming!</p>
      )}

      <nav className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1" role="tablist">
        {([
          ["queue", "Live queue"],
          ["popular", "Most popular"],
          ["people", "People"],
          ["me", "My requests"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-white text-night" : "bg-white/5 text-muted hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "queue" && (
        <div className="flex flex-col gap-5">
          <NowPlaying
            song={data.nowPlaying}
            voted={data.nowPlaying ? voted.has(data.nowPlaying.id) : false}
            mine={data.nowPlaying ? mine.has(data.nowPlaying.id) : false}
            onVote={(on) => data.nowPlaying && vote(data.nowPlaying, on)}
            canVote={!ended}
          />
          {upNext && (
            <section>
              <SectionTitle>Up next</SectionTitle>
              <ul>
                <AnimatePresence initial={false}>
                  <SongCard key={upNext.id} song={upNext} voted={voted.has(upNext.id)} mine={mine.has(upNext.id)} onVote={(on) => vote(upNext, on)} canVote={!ended} />
                </AnimatePresence>
              </ul>
            </section>
          )}
          <section>
            <SectionTitle right={`${data.queue.length} songs`}>Live queue</SectionTitle>
            {data.queue.length === 0 ? (
              <EmptyQueue code={code} canAdd={!ended && data.event.submissionsOpen} />
            ) : (
              <motion.ul layout className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {rest.map((s) => (
                    <SongCard key={s.id} song={s} voted={voted.has(s.id)} mine={mine.has(s.id)} onVote={(on) => vote(s, on)} canVote={!ended} />
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
            <p className="mt-4 text-center text-xs text-muted">
              ❤️ Heart songs to move them up. Everyone gets a fair turn, so one person can&apos;t take over the queue.
            </p>
          </section>
          {data.history.length > 0 && (
            <section>
              <SectionTitle>Already played</SectionTitle>
              <ul className="flex flex-col gap-1 opacity-70">
                {data.history.slice(0, 10).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl p-1.5">
                    <Artwork src={s.artworkUrl} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {s.title} <span className="text-muted">· {s.artist}</span>
                    </span>
                    <span className="text-xs text-muted">♥ {s.votes}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "popular" && (
        <section>
          <SectionTitle>Most popular</SectionTitle>
          {data.popular.length === 0 ? (
            <p className="py-10 text-center text-muted">No hearts yet. Be the first!</p>
          ) : (
            <motion.ul layout className="flex flex-col gap-2">
              {data.popular.map((s, i) => (
                <SongCard
                  key={s.id}
                  song={{ ...s, position: i + 1, pinned: false }}
                  voted={voted.has(s.id)}
                  mine={mine.has(s.id)}
                  onVote={(on) => vote(s, on)}
                  canVote={!ended && s.status !== "skipped"}
                />
              ))}
            </motion.ul>
          )}
        </section>
      )}

      {tab === "people" && <People code={code} eventId={eventId} meId={data.me?.id ?? null} />}

      {tab === "me" && data.me && <MyRequests code={code} data={data} onChanged={refresh} />}

      {!ended && data.event.submissionsOpen && (data.me?.songsSubmitted ?? 0) < data.event.maxPicks && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link href={`/e/${code}/pick`} className="btn btn-primary shadow-2xl">
            ＋ {data.me?.songsSubmitted ? `Add more songs (${data.event.maxPicks - data.me.songsSubmitted} left)` : "Pick your party tracks"}
          </Link>
        </div>
      )}
    </main>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <h2 className="mb-2 flex items-baseline justify-between px-1 text-xs font-bold tracking-[0.3em] text-muted uppercase">
      <span>{children}</span>
      {right && <span className="tracking-normal normal-case">{right}</span>}
    </h2>
  );
}

function EmptyQueue({ code, canAdd }: { code: string; canAdd: boolean }) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
      <Equalizer className="h-8" />
      <p className="text-muted">The queue is empty. Start the party!</p>
      {canAdd && (
        <Link href={`/e/${code}/pick`} className="btn btn-primary">
          Pick your party tracks
        </Link>
      )}
    </div>
  );
}

function People({ code, eventId, meId }: { code: string; eventId: string; meId: string | null }) {
  const { data } = useLiveData<{ people: Person[] }>(`/api/e/${code}/people`, eventId);
  const [q, setQ] = useState("");
  if (!data) return <p className="py-10 text-center text-muted">Loading people…</p>;
  const term = q.trim().toLowerCase().replace(/^@/, "");
  const people = data.people.filter(
    (p) => !term || p.instagram.includes(term) || p.displayName.toLowerCase().includes(term) || p.songs.some((s) => `${s.title} ${s.artist}`.toLowerCase().includes(term)),
  );
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle right={`${data.people.length} guests`}>Who&apos;s here</SectionTitle>
      <input className="field" placeholder="Search people or songs" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.id} className={`glass rounded-2xl p-3 ${p.id === meId ? "ring-1 ring-violet/50" : ""}`}>
            <div className="flex items-center gap-3">
              <Avatar person={p} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.displayName} {p.id === meId && <span className="text-xs text-muted">(you)</span>}
                </p>
                <InstagramLink username={p.instagram} className="text-sm" />
              </div>
              <a
                href={`https://instagram.com/${encodeURIComponent(p.instagram)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost px-3 py-1.5 text-xs"
              >
                Follow ↗
              </a>
            </div>
            {p.songs.length > 0 && (
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {p.songs.map((s) => (
                  <div key={s.id} className="w-20 shrink-0" title={`${s.title} · ${s.artist}`}>
                    <Artwork src={s.artworkUrl} size={80} className={s.status === "played" ? "opacity-60" : ""} />
                    <p className="mt-1 truncate text-[11px]">{s.title}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted">
              {p.songs.length} song{p.songs.length === 1 ? "" : "s"} · ♥ {p.heartsReceived} hearts received
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MyRequests({ code, data, onChanged }: { code: string; data: State; onChanged: () => void }) {
  const toast = useToast();
  const me = data.me!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.displayName);
  const [ig, setIg] = useState(me.instagram);
  const all = [...(data.nowPlaying ? [data.nowPlaying] : []), ...data.queue, ...data.history];
  const my = all.filter((s) => me.mySongIds.includes(s.id));

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await resizeImage(file);
      const res = await fetch(`/api/e/${code}/me/avatar`, { method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" } });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      toast("Profile photo updated", "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const save = async () => {
    try {
      await apiFetch(`/api/e/${code}/me`, { method: "PATCH", json: { displayName: name, instagram: ig } });
      setEditing(false);
      toast("Profile saved", "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const [confirmLeave, setConfirmLeave] = useState(false);
  const leave = async () => {
    try {
      await apiFetch(`/api/e/${code}/me`, { method: "DELETE" });
      window.location.href = "/";
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const withdraw = async (id: string) => {
    try {
      await apiFetch(`/api/e/${code}/songs/${id}`, { method: "DELETE" });
      toast("Song taken out of the queue");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="glass flex items-center gap-4 rounded-3xl p-4">
        <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Change profile photo">
          <Avatar person={me} size={64} />
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-brand text-xs">✎</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
        {editing ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input className="field py-2" value={name} onChange={(e) => setName(e.target.value)} aria-label="Display name" />
            <input className="field py-2" value={ig} onChange={(e) => setIg(e.target.value)} aria-label="Instagram username" autoCapitalize="none" />
            <div className="flex gap-2">
              <button className="btn btn-primary px-4 py-2 text-sm" onClick={save}>Save</button>
              <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{me.displayName}</p>
            <InstagramLink username={me.instagram} />
            <button className="mt-1 block text-xs text-muted hover:text-white" onClick={() => setEditing(true)}>Edit profile</button>
          </div>
        )}
      </div>

      <div>
        <SectionTitle right={`${my.length}/${data.event.maxPicks}`}>Song requests</SectionTitle>
        {my.length === 0 ? (
          <p className="py-6 text-center text-muted">You haven&apos;t picked any songs yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {my.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5">
                <Artwork src={s.artworkUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.title}</p>
                  <p className="truncate text-sm text-muted">{s.artist}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold">
                    {s.status === "playing" ? "▶ Playing" : s.status === "played" ? "✓ Played" : `#${s.position}`}
                  </p>
                  <p className="text-muted">♥ {s.votes}</p>
                  {s.status === "queued" && (
                    <button className="mt-1 text-muted underline hover:text-white" onClick={() => withdraw(s.id)}>
                      remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        className="btn btn-ghost w-full"
        onClick={async () => {
          const r = await shareLink({
            title: `Join ${data.event.name} on We Party`,
            text: `Come pick songs and vote on the music at ${data.event.name} 🎶`,
            url: `${window.location.origin}/e/${code}`,
          });
          if (r === "copied") toast("Party link copied");
        }}
      >
        Invite friends to this party
      </button>
      <Link href={`/e/${code}/replay`} className="text-center text-sm text-muted underline">
        Preview the party replay playlist
      </Link>
      <div className="mt-4 flex flex-col items-center gap-2 border-t border-line pt-4 text-center text-xs text-muted">
        {confirmLeave ? (
          <>
            <p>Delete your profile, photo, hearts and song picks from this party? This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <button className="btn btn-danger px-4 py-2 text-xs" onClick={leave}>Yes, delete my info</button>
              <button className="btn btn-ghost px-4 py-2 text-xs" onClick={() => setConfirmLeave(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <button className="underline-offset-4 hover:text-white hover:underline" onClick={() => setConfirmLeave(true)}>
            Leave party and delete my info
          </button>
        )}
        <Link href="/privacy" className="underline-offset-4 hover:text-white hover:underline">Privacy policy</Link>
      </div>
    </section>
  );
}
