import QRCode from "qrcode";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventById } from "@/lib/services/events";
import { requireEventRole } from "@/lib/services/hosts";
import { eventJoinUrl } from "@/lib/urls";
import { requireHostPage } from "../../../auth";
import { PrintButton } from "./PrintButton";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "QR poster" };

/** A printable poster with the event's QR code. */
export default async function Poster({ params }: Props) {
  const host = await requireHostPage();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event || !(await requireEventRole(host.id, id).catch(() => null))) notFound();
  const url = await eventJoinUrl(event.code);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "H", color: { dark: "#07060c", light: "#ffffff" } });

  return (
    <main className="min-h-dvh bg-night px-4 py-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-[8.5in] items-center justify-between">
        <Link href={`/host/events/${id}`} className="text-sm text-muted hover:text-white">← Back to control room</Link>
        <PrintButton />
      </div>
      <article className="mx-auto flex aspect-[8.5/11] max-w-[8.5in] flex-col items-center justify-between overflow-hidden rounded-3xl bg-[#07060c] p-[6%] text-center text-white print:rounded-none" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <div>
          <p className="font-display text-[clamp(2.5rem,9vw,5.5rem)] font-black leading-none">
            <span className="text-gradient">WEPARTY</span>
          </p>
          <p className="mt-3 text-[clamp(1rem,2.6vw,1.6rem)] font-semibold">Where We All Control the Vibes.</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="font-display text-[clamp(1.2rem,3.5vw,2.2rem)] font-bold">{event.name}</p>
          <div className="mt-5 w-[min(60vw,4.5in)] rounded-[2rem] bg-white p-4 shadow-[0_0_80px_-10px_rgba(255,46,136,0.7)]" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-5 text-[clamp(1rem,2.8vw,1.7rem)] font-bold tracking-wide">SCAN · PICK YOUR SONGS · HEART THE BEST</p>
          <p className="mt-2 text-sm text-[#a39fbd]">
            No app needed. Or go to <b className="text-white">{url.replace(/^https?:\/\//, "")}</b>
          </p>
        </div>
        <p className="text-xs tracking-[0.3em] text-[#a39fbd] uppercase">Powered by <b className="text-white">Offtrack</b></p>
      </article>
    </main>
  );
}
