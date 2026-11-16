import { requireEventByCode } from "@/lib/services/events";
import { submitSongs } from "@/lib/services/queue";
import { api, assertSameOrigin, readJson, requireGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  const body = await readJson(req);
  return submitSongs(event, guest, Array.isArray(body.songs) ? body.songs : []);
});
