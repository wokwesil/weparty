import { badRequest } from "@/lib/errors";
import { endEvent, reopenEvent, setSubmissionsOpen } from "@/lib/services/events";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  const id = (await ctx.params).id;
  const { action } = await readJson(req);
  if (action === "pause") await setSubmissionsOpen(hostId, id, false);
  else if (action === "resume") await setSubmissionsOpen(hostId, id, true);
  else if (action === "end") await endEvent(hostId, id);
  else if (action === "reopen") await reopenEvent(hostId, id);
  else throw badRequest("Unknown action.");
  return { ok: true };
});
