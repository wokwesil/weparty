import { notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { getDeveloperToken } from "@/lib/music/apple";
import { api } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Developer token for MusicKit on the web (designed by Apple to be used in the browser). */
export const GET = api(async () => {
  const token = await getDeveloperToken();
  if (!token) throw notFound("Apple Music isn't connected yet.");
  // hostPlayer only says whether the built-in host player is switched on (no secrets).
  return { token, hostPlayer: env.featureHostPlayer };
});
