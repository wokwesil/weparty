import Link from "next/link";
import { notFound } from "next/navigation";
import { Artwork } from "@/components/Artwork";
import { Avatar, InstagramLink } from "@/components/Avatar";
import { Backdrop, Wordmark } from "@/components/Brand";
import { sql } from "@/lib/db";
import { getEventById } from "@/lib/services/events";
import { getFunnel } from "@/lib/services/dj";
import { listPeople } from "@/lib/services/guests";
import { requireEventRole } from "@/lib/services/hosts";
import { getReplay, getTimeline } from "@/lib/services/queue";
import { eventJoinUrl } from "@/lib/urls";
import { requireHostPage } from "../../../auth";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "Event insights" };

/** Event analytics: attendance, requests, hearts, top songs and contributors. */
export default async function Insights({ params }: Props) {
  const host = await requireHostPage();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event || !(await requireEventRole(host.id, id).catch(() => null))) notFound();
  const [replay, people, timeline, counts, funnel] = await Promise.all([
    getReplay(id),
    listPeople(id),
    getTimeline(id),
    sql<{ submitted: number; requests: number; skipped: number; removed: number; voters: number }[]>`
      select
        (select count(*)::int from queue_items where event_id = ${id}) as submitted,
        (select count(*)::int from song_requests where event_id = ${id}) as requests,
        (select count(*)::int from queue_items where event_id = ${id} and status = 'skipped') as skipped,
        (select count(*)::int from queue_items where event_id = ${id} and status = 'removed') as removed,
        (select count(distinct guest_id)::int from votes where event_id = ${id}) as voters`,
    getFunnel(id),
  ]);
  if (!replay) notFound();
  const c = counts[0];
  const replayUrl = `${await eventJoinUrl(event.code)}/replay`;
  const active = [...people]
    .map((p) => ({ ...p, score: p.songs.length + p.heartsReceived }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const maxBucket = Math.max(1, ...timeline.map((t) => t.votes));
  const stat = (v: number | string, l: string) => (
    <div className="glass rounded-2xl p-4">
      <p className="font-display text-2xl font-bold">{v}</p>
      <p className="text-xs text-muted">{l}</p>
    </div>
  );

  return (
    <main className="relative mx-auto min-h-dvh max-w-5xl px-4 pb-16 pt-4">
      <Backdrop />
      <header className="flex items-center gap-4 py-3">
        <Link href="/host" className="text-sm text-muted hover:text-white">← Events</Link>
        <Wordmark size="sm" />
      </header>
      <h1 className="mt-4 font-display text-3xl font-black">{event.name}</h1>
      <p className="text-muted">Insights · {(event.starts_at ?? event.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}</p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(replay.stats.guests, "attendees")}
        {stat(c.submitted, "different songs requested")}
        {stat(c.requests, "total song picks")}
        {stat(replay.stats.votes, "hearts")}
        {stat(c.voters, "guests who voted")}
        {stat(replay.stats.played, "songs played")}
        {stat(c.skipped, "skipped")}
        {stat(c.removed, "removed")}
      </section>

      <section className="mt-6 glass rounded-3xl p-5">
        <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Join drop-off (QR scan to in the party)</h2>
        {funnel.steps[0].count === 0 ? (
          <p className="mt-2 text-sm text-muted">No scans yet. This fills in as guests open the party link.</p>
        ) : (
          <>
            <ol className="mt-4 flex flex-col gap-3">
              {funnel.steps.map((st, i) => {
                const top = funnel.steps[0].count || 1;
                const prev = i === 0 ? st.count : funnel.steps[i - 1].count;
                const lost = Math.max(0, prev - st.count);
                return (
                  <li key={st.step}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{i + 1}. {st.label}</span>
                      <span>
                        <b>{st.count}</b> <span className="text-muted">({Math.round((st.count / top) * 100)}%)</span>
                        {i > 0 && lost > 0 && <span className="ml-2 text-xs text-rose-300">−{lost} dropped</span>}
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-white/10">
                      <div className="h-2.5 rounded-full bg-brand" style={{ width: `${(st.count / top) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-sm text-muted">
              {funnel.medianSecondsToJoin !== null
                ? `Typical time from scan to in the party: ${funnel.medianSecondsToJoin} seconds (goal: under 30). ${funnel.under30s} guest${funnel.under30s === 1 ? "" : "s"} made it in under 30 seconds.`
                : "Time to join shows up once guests finish joining."}
            </p>
          </>
        )}
      </section>

      <section className="mt-6 glass rounded-3xl p-5">
        <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Playlist links</h2>
        <p className="mt-2 text-sm">Replay page: <a href={replayUrl} className="break-all text-pink underline">{replayUrl}</a></p>
        {event.replay_apple_playlist_url && (
          <p className="mt-1 text-sm">Apple Music: <a href={event.replay_apple_playlist_url} className="break-all text-pink underline">{event.replay_apple_playlist_url}</a></p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn btn-ghost px-3 py-2 text-xs" href={`/api/host/events/${id}/export?list=played&format=csv`}>Played songs (.csv)</a>
          <a className="btn btn-ghost px-3 py-2 text-xs" href={`/api/host/events/${id}/export?list=played&format=txt`}>Played songs (.txt)</a>
        </div>
      </section>

      {timeline.length > 0 && (
        <section className="mt-6 glass rounded-3xl p-5">
          <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Hearts over time (15-minute blocks)</h2>
          <div className="mt-4 flex h-32 items-end gap-1">
            {timeline.map((t) => (
              <div key={String(t.bucket)} className="flex flex-1 flex-col items-center gap-1" title={`${t.votes} hearts`}>
                <div className="w-full rounded-t bg-brand" style={{ height: `${(t.votes / maxBucket) * 100}%` }} />
                <span className="text-[9px] text-muted">{new Date(t.bucket).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Most popular songs</h2>
          <ol className="mt-3 flex flex-col gap-2">
            {replay.mostLiked.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <Artwork src={s.artworkUrl} size={40} />
                <span className="min-w-0 flex-1 truncate text-sm"><b>{s.title}</b> <span className="text-muted">· {s.artist}</span></span>
                <span className="text-sm text-pink">♥ {s.votes}</span>
              </li>
            ))}
            {replay.mostLiked.length === 0 && <li className="text-sm text-muted">No hearts yet.</li>}
          </ol>
          {replay.mostRequested.length > 0 && (
            <>
              <h3 className="mt-5 text-xs font-bold tracking-[0.3em] text-muted uppercase">Most requested</h3>
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {replay.mostRequested.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2"><span className="truncate">{s.title}</span><span className="text-muted">{s.requests}×</span></li>
                ))}
              </ol>
            </>
          )}
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Most active contributors</h2>
          <ol className="mt-3 flex flex-col gap-2">
            {active.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar person={p} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.displayName}</span>
                  <InstagramLink username={p.instagram} className="text-xs" />
                </span>
                <span className="text-right text-xs text-muted">{p.songs.length} songs<br />♥ {p.heartsReceived} received</span>
              </li>
            ))}
            {active.length === 0 && <li className="text-sm text-muted">No guests yet.</li>}
          </ol>
        </section>
      </div>
    </main>
  );
}
