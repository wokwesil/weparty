import { notFound, redirect } from "next/navigation";
import { normalizeSettings } from "@/lib/ranking";
import { getEventByCode } from "@/lib/services/events";
import { getGuestPickedAppleIds } from "@/lib/services/queue";
import { currentGuest } from "@/lib/session";
import { PickTracks } from "./PickTracks";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "Pick your party tracks" };

export default async function PickPage({ params }: Props) {
  const event = await getEventByCode((await params).code);
  if (!event) notFound();
  if (event.status === "ended") redirect(`/e/${event.code}/replay`);
  const guest = await currentGuest(event);
  if (!guest) redirect(`/e/${event.code}/join`);
  const s = normalizeSettings(event.settings);
  const picked = await getGuestPickedAppleIds(guest.id);
  return (
    <PickTracks
      code={event.code}
      eventName={event.name}
      minPicks={s.minPicks}
      maxPicks={s.maxPicks}
      alreadyPicked={picked}
      submissionsOpen={event.submissions_open}
      allowExplicit={s.allowExplicit}
    />
  );
}
