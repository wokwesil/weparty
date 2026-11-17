import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Artwork } from "@/components/Artwork";
import { Avatar, InstagramLink } from "@/components/Avatar";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { DjSpotlight } from "@/components/DjSpotlight";
import { SponsorBanner } from "@/components/SponsorBanner";
import { Requester } from "@/components/SongCard";
import { normalizeSettings } from "@/lib/ranking";
import { getEventByCode } from "@/lib/services/events";
import { getReplay } from "@/lib/services/queue";
import { currentGuest } from "@/lib/session";
import { eventJoinUrl } from "@/lib/urls";
import { ReplayActions } from "./ReplayActions";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const event = await getEventByCode(code);
  if (!event) return { title: "Replay not found" };
  const title = `${event.name} · WeParty Replay`;
  const description = "The songs that actually played, picked and voted by the crowd. Take the party home.";
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: `/e/${event.code}/replay/story?format=og`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description },
  };
}

function fmtHours(ms: number) {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

/** YOUR WEPARTY REPLAY: public, shareable page with the songs actually played. */
export default async function ReplayPage({ params }: Props) {
  const event = await getEventByCode((await params).code);
  if (!event) notFound();
  const replay = await getReplay(event.id);
  if (!replay) notFound();
  const showPeople = normalizeSettings(event.settings).replayShowPeople;
  const guest = await currentGuest(event);
  const shareUrl = `${(await eventJoinUrl(event.code))}/replay`;
  const date = (event.starts_at ?? event.created_at).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  const covers = replay.played.filter((s) => s.artworkUrl).slice(0, 4);
  const live = event.status !== "ended";
  const scrub = <T extends { requester: unknown; alsoRequestedBy: unknown[] }>(s: T): T =>
    showPeople ? s : { ...s, requester: null, alsoRequestedBy: [] };

  return (
    <main className="relative mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <Backdrop />
      <header className="flex items-center justify-between py-2">
        <Link href="/"><Wordmark size="sm" /></Link>
        {guest && !live && <span className="text-xs text-muted">Thanks for coming, {guest.display_name}!</span>}
        {live && guest && <Link href={`/e/${event.code}/party`} className="text-sm text-muted hover:text-white">← Live queue</Link>}
      </header>

      <section className="mt-6 flex flex-col items-center text-center">
        <div className="grid h-48 w-48 grid-cols-2 grid-rows-2 overflow-hidden rounded-3xl shadow-[0_30px_80px_-20px_rgba(255,46,136,0.55)]">
          {covers.length >= 4 ? (
            covers.map((s) => <Artwork key={s.id} src={s.artworkUrl} size={96} className="!rounded-none" />)
          ) : (
            <div className="col-span-2 row-span-2 grid place-items-center bg-brand font-display text-3xl font-black">WP</div>
          )}
        </div>
        <p className="mt-6 text-xs font-bold tracking-[0.35em] text-pink uppercase">{live ? "Replay so far" : "Your WeParty Replay"}</p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight sm:text-4xl">{event.name}</h1>
        <p className="mt-2 text-muted">{[event.venue_name, date].filter(Boolean).join(" · ")}</p>
        {replay.event.sponsor && (
          <div className="mt-3 w-full max-w-xs">
            <SponsorBanner sponsor={replay.event.sponsor} />
          </div>
        )}
        {replay.event.dj && (
          <div className="mt-4 w-full max-w-xs">
            <DjSpotlight dj={replay.event.dj} label={live ? "is spinning" : "was on the decks"} />
          </div>
        )}
        <div className="mt-5 grid w-full max-w-md grid-cols-4 gap-2 text-center">
          {[
            [replay.stats.played, "songs played"],
            [replay.stats.guests, "guests"],
            [replay.stats.votes, "hearts"],
            [replay.stats.durationMs ? fmtHours(replay.stats.durationMs) : "–", "of music"],
          ].map(([v, l]) => (
            <div key={String(l)} className="glass rounded-2xl px-1 py-3">
              <p className="font-display text-lg font-bold">{v}</p>
              <p className="text-[10px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <ReplayActions
        code={event.code}
        eventName={event.name}
        dateLabel={date}
        shareUrl={shareUrl}
        appleIds={replay.played.map((s) => s.appleSongId)}
        replayAppleUrl={event.replay_apple_playlist_url}
      />

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-bold tracking-[0.3em] text-muted uppercase">Songs played, in order</h2>
        {replay.played.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-muted">No songs have played yet. Check back after the party!</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {replay.played.map((raw, i) => {
              const s = scrub(raw);
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2">
                  <span className="w-6 text-center font-display text-xs text-muted">{i + 1}</span>
                  <Artwork src={s.artworkUrl} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.title}</p>
                    <p className="truncate text-sm text-muted">{s.artist}</p>
                    {showPeople && <div className="mt-0.5"><Requester song={s} compact /></div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-muted">
                    <span>♥ {s.votes}</span>
                    {s.appleUrl && (
                      <a href={s.appleUrl} target="_blank" rel="noopener noreferrer" className="text-pink hover:underline">
                        Listen ↗
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <TopList title="Most-liked songs" items={replay.mostLiked.map(scrub)} metric={(s) => `♥ ${s.votes}`} />
        <TopList title="Most-requested songs" items={replay.mostRequested.map(scrub)} metric={(s) => `${s.requests} requests`} />
      </div>

      {showPeople && replay.topContributors.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-bold tracking-[0.3em] text-muted uppercase">The people who made the vibe</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {replay.topContributors.map((p) => (
              <li key={p.id} className="glass flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center">
                <Avatar person={p} size={52} />
                <p className="w-full truncate text-sm font-semibold">{p.displayName}</p>
                <InstagramLink username={p.instagram} className="w-full truncate text-xs" />
                <p className="text-[10px] text-muted">♥ {p.heartsReceived} · {p.songsPlayed} played</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-14 flex flex-col items-center gap-2 text-center">
        <Wordmark size="sm" />
        <p className="text-sm">Where We All Control the Vibes.</p>
        <PoweredBy />
      </footer>
    </main>
  );
}

function TopList({ title, items, metric }: { title: string; items: import("@/lib/types").SongView[]; metric: (s: import("@/lib/types").SongView) => string }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold tracking-[0.3em] text-muted uppercase">{title}</h2>
      <ol className="flex flex-col gap-1.5">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <Artwork src={s.artworkUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.title}</p>
              <p className="truncate text-xs text-muted">{s.artist}</p>
            </div>
            <span className="text-xs text-pink">{metric(s)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
