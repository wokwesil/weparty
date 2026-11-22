import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { appleMusicConfigured, env } from "../env";
import type { Song } from "../types";
import { fromAppleResource, type AppleSongResource } from "./convert";

/**
 * Apple Music "developer token": a short signed note proving WeParty is a
 * registered Apple developer app. It's signed on the server with the private
 * key from the Apple Developer account (that key never leaves the server).
 * The token itself is meant to be handed to MusicKit in the browser.
 */
const cached = new Map<string, { token: string; exp: number }>();

/**
 * @param forBrowser true for the token handed to MusicKit in the browser: it is locked to
 * WeParty's own web address so nobody can lift it for their site. Server-to-Apple calls
 * (search, the health check) use an unlocked one, because servers don't send a web address.
 */
export async function getDeveloperToken({ forBrowser = true } = {}) {
  if (!appleMusicConfigured()) return null;
  const kind = forBrowser ? "browser" : "server";
  const now = Math.floor(Date.now() / 1000);
  const hit = cached.get(kind);
  if (hit && hit.exp - now > 3600) return hit.token;
  const key = await importPKCS8(env.apple.privateKey, "ES256");
  const exp = now + 60 * 60 * 24 * 30; // 30 days (Apple allows up to 6 months)
  const claims: Record<string, unknown> = {};
  if (forBrowser) {
    const origins = new Set<string>();
    if (env.appUrl) origins.add(env.appUrl);
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
    if (origins.size) claims.origin = [...origins];
  }
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: env.apple.keyId })
    .setIssuer(env.apple.teamId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  cached.set(kind, { token, exp });
  return token;
}

let keyCheck: { at: number; result: { works: boolean; problem?: string } } | null = null;

/**
 * Health check: does Apple actually accept WeParty's key? Asks Apple for one song.
 * Remembered for 10 minutes so the health page never hammers Apple. Shows no secrets.
 */
export async function checkAppleKey(): Promise<{ works: boolean; problem?: string }> {
  if (!appleMusicConfigured()) {
    const missing = [
      !env.apple.teamId && "APPLE_TEAM_ID",
      !env.apple.keyId && "APPLE_KEY_ID",
      !env.apple.privateKey && "APPLE_PRIVATE_KEY",
    ].filter(Boolean);
    return { works: false, problem: `Missing in Vercel: ${missing.join(", ")}` };
  }
  if (keyCheck && Date.now() - keyCheck.at < 10 * 60_000) return keyCheck.result;
  let result: { works: boolean; problem?: string };
  try {
    const token = await getDeveloperToken({ forBrowser: false });
    const url = `https://api.music.apple.com/v1/catalog/${env.apple.storefront}/search?term=hello&types=songs&limit=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    result = res.ok
      ? { works: true }
      : {
          works: false,
          problem:
            res.status === 401 || res.status === 403
              ? "Apple rejected the key. Check APPLE_TEAM_ID and APPLE_KEY_ID match the key, and that the key has Media Services (MusicKit) ticked."
              : `Apple answered ${res.status}. Check APPLE_MUSIC_STOREFRONT is a country code like us or gb.`,
        };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result = {
      works: false,
      problem: /pkcs8|key|asn|der|base64/i.test(msg)
        ? "APPLE_PRIVATE_KEY isn't a valid .p8 key. Open the .p8 file in TextEdit/Notepad and paste all of it."
        : "Couldn't reach Apple to check the key. Try again in a minute.",
    };
  }
  keyCheck = { at: Date.now(), result };
  return result;
}

export async function appleCatalogSearch(term: string, limit = 20): Promise<Song[]> {
  const token = await getDeveloperToken({ forBrowser: false });
  if (!token) throw new Error("Apple Music is not configured");
  const url = new URL(`https://api.music.apple.com/v1/catalog/${env.apple.storefront}/search`);
  url.searchParams.set("term", term);
  url.searchParams.set("types", "songs");
  url.searchParams.set("limit", String(Math.min(25, limit)));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Apple Music search failed: ${res.status}`);
  const json = (await res.json()) as { results?: { songs?: { data?: AppleSongResource[] } } };
  return (json.results?.songs?.data ?? []).map(fromAppleResource).filter((s): s is Song => Boolean(s));
}
