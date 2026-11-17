import { AppError, notFound } from "@/lib/errors";
import { flags } from "@/lib/flags";
import { clientIp } from "@/lib/ip";
import { rateLimit } from "@/lib/security";
import { requireEventByCode } from "@/lib/services/events";
import { followOrg } from "@/lib/services/growth";
import { api, assertSameOrigin, currentGuest, readJson } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/** "Follow this DJ/host": the guest opts in to an email about the next party. */
export const POST = api(async (req: Request, ctx: Ctx) => {
  if (!flags.growth) throw notFound();
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  if (!(await rateLimit(`follow:${await clientIp()}`, 20, 600))) {
    throw new AppError(429, "Too many tries. Wait a few minutes.", "rate_limited");
  }
  const b = await readJson(req);
  const guest = await currentGuest(event);
  const r = await followOrg(event, {
    email: String(b.email ?? ""),
    instagram: guest?.instagram_username ?? null,
    consent: b.consent === true,
  });
  return { ok: true, unsubscribeUrl: `/unsubscribe?t=${r.unsubscribeToken}` };
});
