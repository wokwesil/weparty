import { notFound } from "@/lib/errors";
import { getDeveloperToken } from "@/lib/music/apple";
import { api } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Developer token for MusicKit on the web (designed by Apple to be used in the browser). */
export const GET = api(async (req: Request) => {
  const token = await getDeveloperToken();
  // ?check=1 just asks "is Apple Music set up?" (no error in the browser console when it isn't).
  if (new URL(req.url).searchParams.get("check")) return { available: Boolean(token) };
  if (!token) throw notFound("Apple Music isn't connected yet.");
  return { token };
});
