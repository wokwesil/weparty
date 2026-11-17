import Link from "next/link";
import { notFound } from "next/navigation";
import { Backdrop, Wordmark } from "@/components/Brand";
import { getPartyCheck } from "@/lib/services/dj";
import { getEventById } from "@/lib/services/events";
import { requireEventRole } from "@/lib/services/hosts";
import { eventJoinUrl } from "@/lib/urls";
import { requireHostPage } from "../../../auth";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "Party check" };

/** One screen that says whether the event is ready for guests. */
export default async function PartyCheckPage({ params }: Props) {
  const host = await requireHostPage();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event || !(await requireEventRole(host.id, id).catch(() => null))) notFound();
  const joinUrl = await eventJoinUrl(event.code);
  const items = await getPartyCheck(host.id, id, joinUrl);
  const blocking = items.filter((i) => !i.ok && !i.warn);
  const warnings = items.filter((i) => !i.ok && i.warn);

  return (
    <main className="relative mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-4">
      <Backdrop />
      <header className="flex items-center gap-4 py-3">
        <Link href={`/host/events/${id}`} className="min-h-11 py-3 text-sm text-muted hover:text-white">← Back to the event</Link>
        <Wordmark size="sm" />
      </header>
      <h1 className="mt-4 font-display text-3xl font-black">Party check</h1>
      <p className="text-muted">{event.name}</p>

      <div
        className={`mt-6 rounded-3xl p-5 text-lg font-bold ${blocking.length ? "bg-rose-500/20 text-rose-100" : warnings.length ? "bg-amber-500/15 text-amber-100" : "bg-lime/15 text-lime"}`}
        role="status"
      >
        {blocking.length
          ? `⛔ ${blocking.length} thing${blocking.length === 1 ? "" : "s"} to fix before guests arrive`
          : warnings.length
            ? `✅ Ready for guests (${warnings.length} optional extra${warnings.length === 1 ? "" : "s"} below)`
            : "✅ Everything is ready. Let's party!"}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {items.map((i) => (
          <li key={i.id} className="glass flex gap-4 rounded-2xl p-4">
            <span className="text-2xl" aria-hidden>{i.ok ? "✅" : i.warn ? "⚠️" : "⛔"}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {i.label}
                <span className="sr-only">{i.ok ? " (ready)" : i.warn ? " (optional)" : " (needs fixing)"}</span>
              </p>
              <p className="break-words text-sm text-muted">{i.detail}</p>
              {i.fix && <p className="mt-1 text-sm text-amber-100">{i.fix}</p>}
            </div>
          </li>
        ))}
      </ul>

      <section className="glass mt-6 flex flex-col items-center gap-3 rounded-3xl p-5 text-center">
        <h2 className="font-display text-lg font-bold">Test the QR code</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/host/events/${id}/qr?format=png`} alt="Party QR code" className="w-48 rounded-2xl bg-white p-2" />
        <p className="text-sm text-muted">Scan this with your phone camera and join with one song. Then refresh this page.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost min-h-11 px-4 text-sm">Open the guest page ↗</a>
          <Link href={`/host/events/${id}/check`} className="btn btn-primary min-h-11 px-4 text-sm">Re-check</Link>
        </div>
      </section>
      <p className="mt-6 text-center text-xs text-muted">Full night-of checklist: NOV22_RUNBOOK.md in the We Party code.</p>
    </main>
  );
}
