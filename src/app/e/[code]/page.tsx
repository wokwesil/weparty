import Link from "next/link";
import { notFound } from "next/navigation";
import { Backdrop, Equalizer, PoweredBy, Wordmark } from "@/components/Brand";
import { getEventByCode } from "@/lib/services/events";
import { currentGuest } from "@/lib/session";
import type { Metadata } from "next";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventByCode((await params).code);
  return event
    ? { title: event.name, description: `Join ${event.name} on WeParty. Pick your tracks, heart the best ones, control the vibes.` }
    : { title: "Party not found" };
}

/** The screen guests land on after scanning the party QR code. */
export default async function EventWelcome({ params }: Props) {
  const event = await getEventByCode((await params).code);
  if (!event) notFound();
  const guest = await currentGuest(event);
  const ended = event.status === "ended";
  const next = ended ? `/e/${event.code}/replay` : guest ? `/e/${event.code}/party` : `/e/${event.code}/join`;
  const date = event.starts_at
    ? event.starts_at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] text-center">
      <Backdrop />
      <Wordmark size="sm" />
      <section className="flex w-full max-w-md flex-col items-center">
        <Equalizer className="mb-6 h-8" bars={6} />
        <p className="text-xs font-semibold tracking-[0.4em] text-muted uppercase">You&apos;re invited to</p>
        <h1 className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">{event.name}</h1>
        {(event.venue_name || date) && (
          <p className="mt-3 text-muted">{[event.venue_name, date].filter(Boolean).join(" · ")}</p>
        )}
        {event.description && <p className="mt-4 text-sm text-white/80">{event.description}</p>}
        <div className="mt-10 glass w-full rounded-3xl p-5 text-left text-sm">
          <ol className="space-y-2.5">
            {[
              ["01", "Add your Instagram so people can find you"],
              ["02", "Pick your party tracks"],
              ["03", "Heart the songs you want next"],
              ["04", "Take the playlist home"],
            ].map(([n, t]) => (
              <li key={n} className="flex items-center gap-3">
                <span className="font-display text-xs text-pink">{n}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
        <Link href={next} className="btn btn-primary mt-8 w-full py-4 text-lg">
          {ended ? "SEE THE REPLAY" : guest ? "BACK TO THE PARTY" : "ENTER PARTY"}
        </Link>
        <p className="mt-4 text-xs text-muted">No app download. No passwords. Just vibes.</p>
      </section>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold">Where We All Control the Vibes.</p>
        <PoweredBy />
      </div>
    </main>
  );
}
