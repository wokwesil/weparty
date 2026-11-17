import { getCrowdPulse } from "@/lib/services/dj";
import { requireEventRole } from "@/lib/services/hosts";
import { api, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

/** Crowd Pulse: suggestions for the DJ. */
export const GET = api(async (_req: Request, ctx: Ctx) => {
  const hostId = await requireHostId();
  const id = (await ctx.params).id;
  await requireEventRole(hostId, id);
  return getCrowdPulse(id);
});
