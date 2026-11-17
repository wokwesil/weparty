import { requireEventByCode } from "@/lib/services/events";
import { reportGuest } from "@/lib/services/dj";
import { api, assertSameOrigin, readJson, requireGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/** A guest reports another guest to the host. */
export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  const b = await readJson(req);
  return reportGuest(event, guest, String(b.guestId ?? ""), String(b.reason ?? ""));
});
