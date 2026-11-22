import { headers } from "next/headers";
import { cleanPath, cleanReferrer, eventCodeFromPath, isBot, parseUserAgent, recordHit } from "@/lib/services/analytics";
import { getEventByCode } from "@/lib/services/events";
import { currentGuest, currentHostId, readJson } from "@/lib/session";

export const dynamic = "force-dynamic";

function header(h: Headers, name: string, max: number) {
  const v = h.get(name);
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, max) || null;
  } catch {
    return v.slice(0, max) || null;
  }
}

/**
 * Page view / "still here" beacon for the owner dashboard. Never fails loudly:
 * analytics must never get in the way of a guest.
 */
export async function POST(req: Request) {
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    const body = await readJson(req);
    const visitorId = String(body.v ?? "");
    const path = cleanPath(String(body.p ?? ""));
    if (!isBot(ua) && path && /^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) {
      const kind = body.t === "view" ? "view" : "ping";
      const eventCode = eventCodeFromPath(path);
      let guestId: string | null = null;
      let partyCode: string | null = null;
      if (eventCode) {
        const event = await getEventByCode(eventCode).catch(() => null);
        if (event) {
          partyCode = event.code;
          guestId = (await currentGuest(event).catch(() => null))?.id ?? null;
        }
      }
      const ownHost = (h.get("host") ?? "").split(":")[0];
      const { device, browser } = parseUserAgent(ua);
      await recordHit({
        visitorId,
        path,
        kind,
        referrer: typeof body.r === "string" && kind === "view" ? cleanReferrer(body.r, ownHost) : null,
        device: body.app === true ? "App" : device,
        browser,
        country: header(h, "x-vercel-ip-country", 4),
        region: header(h, "x-vercel-ip-country-region", 60),
        city: header(h, "x-vercel-ip-city", 80),
        hostId: await currentHostId().catch(() => null),
        guestId,
        eventCode: partyCode,
      });
    }
  } catch (err) {
    console.error("track", err);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
