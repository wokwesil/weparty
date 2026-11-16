import { notFound, redirect } from "next/navigation";
import { getEventByCode } from "@/lib/services/events";
import { currentGuest } from "@/lib/session";
import { JoinForm } from "./JoinForm";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "Join the party" };

export default async function JoinPage({ params }: Props) {
  const event = await getEventByCode((await params).code);
  if (!event) notFound();
  if (event.status === "ended") redirect(`/e/${event.code}/replay`);
  if (await currentGuest(event)) redirect(`/e/${event.code}/party`);
  return <JoinForm code={event.code} eventName={event.name} />;
}
