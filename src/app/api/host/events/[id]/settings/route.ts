import { updateSettings } from "@/lib/services/events";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  return { settings: await updateSettings(await requireHostId(), (await ctx.params).id, await readJson(req)) };
});
