import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { getEventByCode, toPublicEvent } from "@/lib/services/events";
import { currentGuest } from "@/lib/session";
import type { Metadata } from "next";
import { JoinForm } from "./join/JoinForm";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventByCode((await params).code);
  return event
    ? { title: event.name, description: `Join ${event.name} on WeParty. Pick your tracks, heart the best ones, control the vibes.` }
    : { title: "Party not found" };
}

/**
 * The screen guests land on after scanning the party QR code.
 * Joining happens right here, on one screen, so the QR scan to "in the party"
 * takes seconds. Guests who already joined on this phone go straight in.
 */
export default async function EventWelcome({ params }: Props) {
  const event = await getEventByCode((await params).code);
  if (!event) notFound();
  const guest = await currentGuest(event);
  if (guest && event.status !== "ended") redirect(`/e/${event.code}/party`);
  const ended = event.status === "ended";
  const pub = toPublicEvent(event);
  const date = event.starts_at
    ? event.starts_at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  if (ended) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <Backdrop />
        <Wordmark size="sm" />
        <h1 className="font-display text-3xl font-black">{event.name}</h1>
        <p className="text-muted">This party has ended. Here&apos;s what played.</p>
        <Link href={`/e/${event.code}/replay`} className="btn btn-primary w-full max-w-sm py-4 text-lg">
          SEE THE REPLAY
        </Link>
        <PoweredBy />
      </main>
    );
  }

  return (
    <JoinForm
      code={event.code}
      eventName={event.name}
      subtitle={[event.venue_name, date].filter(Boolean).join(" · ") || null}
      dj={pub.dj}
      submissionsOpen={pub.submissionsOpen}
      vibes={pub.vibes}
    />
  );
}
