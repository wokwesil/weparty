import "server-only";

/**
 * Feature switches. A feature is OFF unless the matching setting is "1" in
 * Vercel (Settings > Environment Variables).
 *
 *   FEATURE_GROWTH=1          "Your night in music" recap, taste matches,
 *                             "Follow this DJ" emails, "Host your own party" links
 *   FEATURE_TERMS=1           Host terms checkbox when creating an event
 */
const on = (name: string) => process.env[name] === "1";

export const flags = {
  get growth() {
    return on("FEATURE_GROWTH");
  },
  get terms() {
    return on("FEATURE_TERMS");
  },
};
