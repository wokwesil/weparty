import { refreshPayoutStatus, startPayoutOnboarding } from "@/lib/services/payments";
import { requireOrgRole } from "@/lib/services/hosts";
import { api, assertSameOrigin, requireHostId } from "@/lib/session";
import { baseUrl } from "@/lib/urls";

type Ctx = { params: Promise<{ orgId: string }> };

/** Starts (or continues) Stripe payout setup so tips and boosts reach the DJ/host. */
export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  return startPayoutOnboarding(await requireHostId(), (await ctx.params).orgId, await baseUrl());
});

/** Re-checks with Stripe whether payouts are ready. */
export const GET = api(async (_req: Request, ctx: Ctx) => {
  const hostId = await requireHostId();
  const { orgId } = await ctx.params;
  await requireOrgRole(hostId, orgId);
  return { payoutsEnabled: await refreshPayoutStatus(orgId) };
});
