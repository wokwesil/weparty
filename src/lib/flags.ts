import "server-only";

/**
 * Feature switches. Everything new and money-related is OFF unless the
 * matching setting is "1" in Vercel (Settings > Environment Variables).
 * That way nothing half-finished can show up at a live party.
 *
 *   FEATURE_PAYMENTS=1        Song Boosts + DJ Tips (Stripe, test mode)
 *   FEATURE_PLANS=1           Pricing page, upgrade buttons and plan limits
 *   FEATURE_SPONSOR=1         "Presented by ___" banner
 *   FEATURE_GROWTH=1          "Your night in music" recap, taste matches,
 *                             "Follow this DJ" emails, "Host your own party" links
 *   FEATURE_TERMS=1           Host terms checkbox when creating an event
 *   PAYMENTS_IN_NATIVE_APP=1  Also show payment buttons inside the iPhone/Android
 *                             apps (leave OFF: see docs/PAYMENTS.md)
 */
const on = (name: string) => process.env[name] === "1";

export const flags = {
  get payments() {
    return on("FEATURE_PAYMENTS");
  },
  get plans() {
    return on("FEATURE_PLANS");
  },
  get sponsor() {
    return on("FEATURE_SPONSOR");
  },
  get growth() {
    return on("FEATURE_GROWTH");
  },
  get terms() {
    return on("FEATURE_TERMS");
  },
  get paymentsInNativeApp() {
    return on("PAYMENTS_IN_NATIVE_APP");
  },
};
