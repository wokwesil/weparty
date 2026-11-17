import { notFound } from "@/lib/errors";
import { flags } from "@/lib/flags";
import { requireEventByCode } from "@/lib/services/events";
import { getTasteMatches } from "@/lib/services/growth";
import { api, requireGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/** "People who share your taste" at this party. */
export const GET = api(async (_req: Request, ctx: Ctx) => {
  if (!flags.growth) throw notFound();
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  return { matches: await getTasteMatches(event, guest) };
});
