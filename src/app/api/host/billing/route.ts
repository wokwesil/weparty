import { badRequest } from "@/lib/errors";
import { createBillingPortal, createPlanCheckout } from "@/lib/services/payments";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";
import { baseUrl } from "@/lib/urls";

/** Upgrade (Stripe Checkout) or manage billing (Stripe customer portal). */
export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  const b = await readJson(req);
  const orgId = String(b.orgId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) throw badRequest("Pick an account.");
  const origin = await baseUrl();
  if (b.action === "portal") return createBillingPortal(hostId, orgId, origin);
  const eventId = b.eventId ? String(b.eventId) : null;
  if (eventId && !/^[0-9a-f-]{36}$/i.test(eventId)) throw badRequest("Bad event.");
  return createPlanCheckout(hostId, orgId, String(b.plan ?? ""), eventId, origin);
});
