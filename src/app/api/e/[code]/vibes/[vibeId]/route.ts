import { blockMatch, type BlockEntry } from "@/lib/blocklist";
import { sql } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { clientIp, deviceId } from "@/lib/ip";
import { vibeCrate } from "@/lib/music/vibeCrate";
import { normalizeSettings } from "@/lib/ranking";
import { rateLimit } from "@/lib/security";
import { requireEventByCode } from "@/lib/services/events";
import { api } from "@/lib/session";

type Ctx = { params: Promise<{ code: string; vibeId: string }> };
export const dynamic = "force-dynamic";

/** Starter songs for one of tonight's vibes, already filtered for this party's rules. */
export const GET = api(async (_req: Request, ctx: Ctx) => {
  const { code, vibeId } = await ctx.params;
  const event = await requireEventByCode(code);
  const settings = normalizeSettings(event.settings);
  if (!settings.vibes.includes(vibeId)) throw notFound("That vibe isn't on tonight's list.");
  const ip = await clientIp();
  const device = await deviceId();
  const ok =
    (await rateLimit(`search:ip:${ip}`, device ? 1500 : 60, 60)) && (!device || (await rateLimit(`search:dev:${device}`, 40, 60)));
  if (!ok) throw new AppError(429, "Slow down a little! Try again in a moment.", "rate_limited");

  const blocks = await sql<BlockEntry[]>`select kind, value, label from event_blocklist where event_id = ${event.id}`;
  const songs = (await vibeCrate(vibeId)).filter((s) => (settings.allowExplicit || !s.explicit) && !blockMatch(s, blocks));
  return { vibeId, songs };
});
