import { notFound } from "next/navigation";
import { getEventById } from "@/lib/services/events";
import { requireEventRole } from "@/lib/services/hosts";
import { eventJoinUrl } from "@/lib/urls";
import { requireHostPage } from "../../auth";
import { ControlRoom } from "./ControlRoom";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "Control room" };

export default async function ControlRoomPage({ params }: Props) {
  const host = await requireHostPage();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  const role = await requireEventRole(host.id, id).catch(() => null);
  if (!role) notFound();
  return (
    <ControlRoom
      eventId={event.id}
      code={event.code}
      joinUrl={await eventJoinUrl(event.code)}
      initial={{
        name: event.name,
        venueName: event.venue_name ?? "",
        description: event.description ?? "",
        startsAt: event.starts_at ? event.starts_at.toISOString() : "",
        replayAppleUrl: event.replay_apple_playlist_url ?? "",
      }}
      role={role}
    />
  );
}
