import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { requireEventByCode } from "@/lib/services/events";
import { createBoostCheckout, createTipCheckout } from "@/lib/services/payments";
import { api, assertSameOrigin, readJson, requireGuest } from "@/lib/session";
import { baseUrl } from "@/lib/urls";

type Ctx = { params: Promise<{ code: string }> };

/** Starts a Stripe Checkout for a Song Boost or a DJ tip. Returns the checkout URL. */
export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  if (!(await rateLimit(`pay:${guest.id}`, 10, 600))) throw new AppError(429, "Too many tries. Wait a few minutes.", "rate_limited");
  const b = await readJson(req);
  const amount = Math.round(Number(b.amount));
  const origin = await baseUrl();
  if (b.kind === "boost") return createBoostCheckout(event, guest, String(b.itemId ?? ""), amount, origin);
  if (b.kind === "tip") return createTipCheckout(event, guest, amount, origin);
  throw new AppError(400, "Unknown payment.");
});
