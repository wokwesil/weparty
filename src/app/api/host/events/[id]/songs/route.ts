import { hostAddSong } from "@/lib/services/queue";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  return { id: await hostAddSong(await requireHostId(), (await ctx.params).id, b.song) };
});
