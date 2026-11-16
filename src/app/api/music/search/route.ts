import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { searchSongs } from "@/lib/music/search";
import { rateLimit } from "@/lib/security";
import { api } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = api(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`search:${ip}`, 40, 60))) {
    throw new AppError(429, "Slow down a little! Try searching again in a moment.", "rate_limited");
  }
  try {
    return await searchSongs(q);
  } catch (err) {
    console.warn("[search] failed", err);
    // Tell the phone to try Apple's public search directly.
    return { songs: [], source: "unavailable", fallback: "client-itunes" };
  }
});
