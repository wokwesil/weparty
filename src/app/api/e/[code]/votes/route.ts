import { AppError, badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { requireEventByCode } from "@/lib/services/events";
import { setVote } from "@/lib/services/queue";
import { api, assertSameOrigin, readJson, requireGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  const body = await readJson(req);
  const itemId = String(body.itemId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw badRequest("Missing song.");
  if (!(await rateLimit(`vote:${guest.id}`, 60, 60))) throw new AppError(429, "Easy on the hearts! Try again in a moment.", "rate_limited");
  return setVote(event, guest, itemId, body.on !== false);
});
