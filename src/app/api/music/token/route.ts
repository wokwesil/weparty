import { notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { getDeveloperToken } from "@/lib/music/apple";
import { api } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Developer token for MusicKit on the web (designed by Apple to be used in the browser). */
export const GET = api(async (req: Request) => {
  // A wrongly pasted key must not break the page: just treat Apple Music as not set up.
  const token = await getDeveloperToken().catch((err) => {
    console.error("[apple] can't sign the Apple Music token; check APPLE_PRIVATE_KEY", err);
    return null;
  });
  // ?check=1 just asks "is Apple Music set up?" (no error in the browser console when it isn't).
  if (new URL(req.url).searchParams.get("check")) return { available: Boolean(token) };
  if (!token) throw notFound("Apple Music isn't connected yet.");
  // hostPlayer only says whether the built-in host player is switched on (no secrets).
  return { token, hostPlayer: env.featureHostPlayer };
});
