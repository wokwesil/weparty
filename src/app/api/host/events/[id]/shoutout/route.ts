import { clearShoutouts, postShoutout } from "@/lib/services/dj";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  return postShoutout(await requireHostId(), (await ctx.params).id, String(b.message ?? ""));
});

export const DELETE = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  await clearShoutouts(await requireHostId(), (await ctx.params).id);
  return { ok: true };
});
