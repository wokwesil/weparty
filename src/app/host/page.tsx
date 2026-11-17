import Link from "next/link";
import { Backdrop, Wordmark } from "@/components/Brand";
import { flags } from "@/lib/flags";
import { followerCount } from "@/lib/services/growth";
import { listHostEvents } from "@/lib/services/events";
import { StatusPill } from "@/components/StatusPill";
import { requireHostPage } from "./auth";
import { DeleteAccount, HostHeaderActions, NewEventForm, TeamPanel } from "./DashboardClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host dashboard" };

export default async function HostDashboard() {
  const host = await requireHostPage();
  const events = await listHostEvents(host.id);
  const live = events.filter((e) => e.status !== "ended");
  const past = events.filter((e) => e.status === "ended");
  const totals = events.reduce(
    (t, e) => ({ guests: t.guests + e.guests, songs: t.songs + e.songs, votes: t.votes + e.votes, played: t.played + e.played }),
    { guests: 0, songs: 0, votes: 0, played: 0 },
  );
  const adminOrgs = host.orgs.filter((o) => o.role !== "dj");
  const followers = flags.growth ? await Promise.all(adminOrgs.map(async (o) => ({ ...o, count: await followerCount(o.id) }))) : [];

  return (
    <main className="relative mx-auto min-h-dvh max-w-5xl px-4 pb-16 pt-4 sm:px-6">
      <Backdrop />
      <header className="flex items-center gap-4 py-3">
        <Link href="/" className="tap"><Wordmark size="sm" /></Link>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Host</span>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted">
          <span className="hidden sm:inline">{host.displayName}</span>
          <HostHeaderActions />
        </div>
      </header>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="font-display text-3xl font-black">Your parties</h1>
            <p className="mt-1 text-muted">Create an event, print its QR code, and run the queue live from your phone.</p>
          </div>

          <EventList title="Live & upcoming" events={live} empty="No live events. Create one to get your QR code." />
          {past.length > 0 && <EventList title="Event history" events={past} empty="" />}
        </div>

        <aside className="flex flex-col gap-6">
          {adminOrgs.length > 0 && <NewEventForm orgs={adminOrgs.map((o) => ({ id: o.id, name: o.name }))} requireTerms={flags.terms} />}
          <div className="glass rounded-3xl p-5">
            <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">All-time</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                [events.length, "events"],
                [totals.guests, "guests"],
                [totals.songs, "songs requested"],
                [totals.votes, "hearts"],
              ].map(([v, l]) => (
                <div key={String(l)}>
                  <p className="font-display text-2xl font-bold">{v}</p>
                  <p className="text-xs text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
          {followers.length > 0 && (
            <div className="glass rounded-3xl p-5">
              <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Followers</h2>
              <p className="mt-1 text-xs text-muted">Guests who asked to hear about your next party by email.</p>
              <ul className="mt-3 flex flex-col gap-2">
                {followers.map((o) => (
                  <li key={o.id} className="flex items-center gap-3">
                    <span className="font-display text-2xl font-bold">{o.count}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{followers.length > 1 ? o.name : "following you"}</span>
                    {o.count > 0 && (
                      <a href={`/api/host/orgs/${o.id}/followers`} className="btn btn-ghost min-h-11 px-3 py-1.5 text-xs" download>
                        Download list
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Only email them about your parties, and always include an unsubscribe link.</p>
            </div>
          )}
          <TeamPanel orgs={host.orgs} />
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-muted">
            <Link href="/support" className="tap hover:text-white">Help &amp; support</Link>
            <Link href="/privacy" className="tap hover:text-white">Privacy</Link>
            {flags.terms && <Link href="/terms" className="tap hover:text-white">Host terms</Link>}
          </div>
          <DeleteAccount />
        </aside>
      </section>
    </main>
  );
}

function EventList({ title, events, empty }: { title: string; events: Awaited<ReturnType<typeof listHostEvents>>; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold tracking-[0.3em] text-muted uppercase">{title}</h2>
      {events.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-center text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id} className="glass rounded-3xl p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={e.status} open={e.submissionsOpen} />
                    <span className="font-mono text-xs text-muted">/{e.code}</span>
                  </div>
                  <Link href={`/host/events/${e.id}`} className="mt-1 block truncate text-lg font-bold hover:underline">
                    {e.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {[e.venueName, new Date(e.startsAt ?? e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), e.orgName]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center text-xs text-muted">
                  {[[e.guests, "guests"], [e.songs, "songs"], [e.votes, "hearts"], [e.played, "played"]].map(([v, l]) => (
                    <div key={String(l)}>
                      <p className="font-display text-lg font-bold text-white">{v}</p>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/host/events/${e.id}`} className="btn btn-primary px-4 py-2 text-sm">{e.status === "ended" ? "Open" : "Control room"}</Link>
                <Link href={`/host/events/${e.id}/poster`} className="btn btn-ghost px-4 py-2 text-sm">QR poster</Link>
                <Link href={`/host/events/${e.id}/insights`} className="btn btn-ghost px-4 py-2 text-sm">Insights</Link>
                <Link href={`/e/${e.code}/replay`} className="btn btn-ghost px-4 py-2 text-sm">Replay page</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
