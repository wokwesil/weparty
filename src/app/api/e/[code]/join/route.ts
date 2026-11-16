import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
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
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`join:${ip}:${event.id}`, 15, 600))) {
    throw new AppError(429, "Too many sign-ups from this network. Wait a few minutes.", "rate_limited");
  }
  const body = await readJson(req);
  const { guest, token } = await registerGuest(event, {
    displayName: String(body.displayName ?? ""),
    instagram: String(body.instagram ?? ""),
  });
  await setGuestCookie(event.id, token);
  return { guest: toPerson(guest), existing: false };
});
