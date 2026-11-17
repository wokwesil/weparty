import "server-only";
import Stripe from "stripe";
import { badRequest } from "../errors";

let client: Stripe | null = null;

/**
 * The Stripe client. The secret key lives only in Vercel (STRIPE_SECRET_KEY).
 * Until William explicitly allows live payments (STRIPE_ALLOW_LIVE=1), only
 * test keys (sk_test_...) are accepted, so no real card can be charged.
 */
export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) throw badRequest("Payments aren't set up yet.", "payments_off");
  if (!/^(sk|rk)_test_/.test(key) && process.env.STRIPE_ALLOW_LIVE !== "1") {
    throw new Error("Refusing to use a live Stripe key. Set STRIPE_ALLOW_LIVE=1 only when you're ready for real payments.");
  }
  client = new Stripe(key);
  return client;
}

/** For tests: swap in a fake Stripe client (null restores the real one). */
export function setStripeForTests(fake: unknown) {
  client = fake as Stripe | null;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY) || client !== null;
}
