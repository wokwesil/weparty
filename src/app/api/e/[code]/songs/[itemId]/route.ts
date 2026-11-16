import { requireEventByCode } from "@/lib/services/events";
import { withdrawSong } from "@/lib/services/queue";
import { api, assertSameOrigin, requireGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string; itemId: string }> };

export const DELETE = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { code, itemId } = await ctx.params;
  const event = await requireEventByCode(code);
  const guest = await requireGuest(event);
  await withdrawSong(event, guest, itemId);
  return { ok: true };
});
