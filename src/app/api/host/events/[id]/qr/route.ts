import QRCode from "qrcode";
import { notFound } from "@/lib/errors";
import { getEventById } from "@/lib/services/events";
import { requireEventRole } from "@/lib/services/hosts";
import { api, requireHostId } from "@/lib/session";
import { eventJoinUrl } from "@/lib/urls";

type Ctx = { params: Promise<{ id: string }> };

/** The event's QR code as a high-resolution PNG or SVG (for printing). */
export const GET = api(async (req: Request, ctx: Ctx) => {
  const hostId = await requireHostId();
  const id = (await ctx.params).id;
  await requireEventRole(hostId, id);
  const event = await getEventById(id);
  if (!event) throw notFound();
  const url = await eventJoinUrl(event.code);
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const filename = `weparty-${event.code}-qr.${format}`;
  if (format === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "H" });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  }
  const png = await QRCode.toBuffer(url, { width: 1200, margin: 2, errorCorrectionLevel: "H" });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${filename}"` },
  });
});
