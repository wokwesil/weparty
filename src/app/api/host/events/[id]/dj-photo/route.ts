import { setDjPhoto } from "@/lib/services/dj";
import { api, assertSameOrigin, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  const buf = Buffer.from(await req.arrayBuffer());
  await setDjPhoto(hostId, (await ctx.params).id, buf);
  return { ok: true };
});
