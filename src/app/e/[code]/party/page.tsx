import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getEventByCode } from "@/lib/services/events";
import { currentGuest } from "@/lib/session";
import { PartyRoom } from "./PartyRoom";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "Live queue" };

export default async function PartyPage({ params }: Props) {
  const event = await getEventByCode((await params).code);
  if (!event) notFound();
  const guest = await currentGuest(event);
  if (!guest) redirect(event.status === "ended" ? `/e/${event.code}/replay` : `/e/${event.code}/join`);
  return (
    <Suspense>
      <PartyRoom code={event.code} eventId={event.id} />
    </Suspense>
  );
}
