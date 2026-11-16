import { badRequest } from "@/lib/errors";
import { requireEventByCode } from "@/lib/services/events";
import { setGuestAvatar } from "@/lib/services/guests";
import { api, assertSameOrigin, requireGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/** Upload a profile photo (the phone shrinks it to 400x400 before sending). */
export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 500_000) throw badRequest("That photo is too large.");
  const buf = Buffer.from(await req.arrayBuffer());
  await setGuestAvatar(guest, buf);
  return { ok: true };
});
