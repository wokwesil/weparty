import "server-only";

/**
 * Feature switches, set in Vercel (Settings > Environment Variables).
 *
 *   FEATURE_GROWTH            ON unless set to "0": "Your night in music" recap,
 *                             taste matches, "Follow this DJ" emails,
 *                             "Host your own party" links
 *   FEATURE_TERMS=1           OFF unless "1": extra "I agree" checkbox when a
 *                             host creates an event. (/terms itself is always
 *                             public and linked from join and sign-up.)
 *   FEATURE_VIBE_PRICING=1    OFF unless "1": hosts see a price box next to each
 *                             of tonight's vibes. Prices are only SAVED: nobody is
 *                             charged and guests never see them until WeParty
 *                             payments exist and are switched on.
 */
const on = (name: string) => process.env[name] === "1";
const notOff = (name: string) => process.env[name] !== "0";

export const flags = {
  get growth() {
    return notOff("FEATURE_GROWTH");
  },
  get terms() {
    return on("FEATURE_TERMS");
  },
  get vibePricing() {
    return on("FEATURE_VIBE_PRICING");
  },
};
