import { badRequest } from "@/lib/errors";
import { hostQueueAction, type HostAction } from "@/lib/services/queue";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
const TYPES = new Set(["next", "play_now", "finish_current", "skip", "remove", "restore", "move", "unpin", "unpin_all"]);

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  const b = await readJson(req);
  if (!TYPES.has(String(b.type))) throw badRequest("Unknown action.");
  if (b.itemId !== undefined && !/^[0-9a-f-]{36}$/i.test(String(b.itemId))) throw badRequest("Bad song id.");
  return hostQueueAction(hostId, (await ctx.params).id, {
    type: b.type,
    itemId: b.itemId ? String(b.itemId) : undefined,
    toIndex: Number(b.toIndex ?? 0),
  } as HostAction);
});
