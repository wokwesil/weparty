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
};
