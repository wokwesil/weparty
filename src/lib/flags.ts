import "server-only";

/**
 * Feature switches, set in Vercel (Settings > Environment Variables).
 *
 *   FEATURE_GROWTH            ON unless set to "0": "Your night in music" recap,
 *                             taste matches, "Follow this DJ" emails,
 *                             "Host your own party" links
 *   FEATURE_TERMS=1           OFF unless "1": host terms checkbox when creating
 *                             an event (turn on after a lawyer reviews /terms)
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
