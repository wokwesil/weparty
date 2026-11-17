import { AppError } from "@/lib/errors";
import { clientIp, deviceId } from "@/lib/ip";
import { searchSongs } from "@/lib/music/search";
import { rateLimit } from "@/lib/security";
import { api } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = api(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  // A whole venue can share one Wi-Fi address: limit each phone, with a high cap per address.
  const ip = await clientIp();
  const device = await deviceId();
  const ok =
    (await rateLimit(`search:ip:${ip}`, device ? 1500 : 60, 60)) && (!device || (await rateLimit(`search:dev:${device}`, 40, 60)));
  if (!ok) throw new AppError(429, "Slow down a little! Try searching again in a moment.", "rate_limited");
  try {
    return await searchSongs(q);
  } catch (err) {
    console.warn("[search] failed", err);
    // Tell the phone to try Apple's public search directly.
    return { songs: [], source: "unavailable", fallback: "client-itunes" };
  }
});
