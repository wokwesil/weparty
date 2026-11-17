import { AppError } from "@/lib/errors";
import { clientIp, deviceId } from "@/lib/ip";
import { rateLimit } from "@/lib/security";
import { requireEventByCode } from "@/lib/services/events";
import { registerGuest, toPerson } from "@/lib/services/guests";
import { api, assertSameOrigin, currentGuest, readJson, setGuestCookie } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const existing = await currentGuest(event);
  if (existing) return { guest: toPerson(existing), existing: true };
  // Everyone at a venue often shares one Wi-Fi address, so the per-address
  // limit is generous (a 300-person party) and each phone gets its own limit.
  const ip = await clientIp();
  const device = await deviceId();
  const allowed =
    (await rateLimit(`join:${ip}:${event.id}`, 300, 600)) &&
    (!device || (await rateLimit(`join:dev:${device}`, 8, 600)));
  if (!allowed) throw new AppError(429, "Too many sign-ups from this phone or network. Wait a few minutes.", "rate_limited");
  const body = await readJson(req);
  const { guest, token } = await registerGuest(event, {
    displayName: String(body.displayName ?? ""),
    instagram: String(body.instagram ?? ""),
  });
  await setGuestCookie(event.id, token);
  return { guest: toPerson(guest), existing: false };
});
