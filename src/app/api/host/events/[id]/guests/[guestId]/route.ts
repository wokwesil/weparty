import { removeGuest } from "@/lib/services/guests";
import { api, assertSameOrigin, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; guestId: string }> };

export const DELETE = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id, guestId } = await ctx.params;
  await removeGuest(await requireHostId(), id, guestId);
  return { ok: true };
});
