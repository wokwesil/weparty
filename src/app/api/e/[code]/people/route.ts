import { AppError } from "@/lib/errors";
import { requireEventByCode } from "@/lib/services/events";
import { listPeople } from "@/lib/services/guests";
import { requireEventRole } from "@/lib/services/hosts";
import { api, currentGuest, currentHostId } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

export const GET = api(async (_req: Request, ctx: Ctx) => {
  const event = await requireEventByCode((await ctx.params).code);
  if (!(await currentGuest(event))) {
    const hostId = await currentHostId();
    const ok = hostId ? await requireEventRole(hostId, event.id).then(() => true, () => false) : false;
    if (!ok) throw new AppError(401, "Join the party first.", "not_joined");
  }
  return { people: await listPeople(event.id) };
});
