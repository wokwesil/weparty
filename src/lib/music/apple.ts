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
let cached: { token: string; exp: number } | null = null;

export async function getDeveloperToken() {
  if (!appleMusicConfigured()) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - now > 3600) return cached.token;
  const key = await importPKCS8(env.apple.privateKey, "ES256");
  const exp = now + 60 * 60 * 24 * 30; // 30 days (Apple allows up to 6 months)
  const claims: Record<string, unknown> = {};
  if (env.appUrl) claims.origin = [env.appUrl];
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: env.apple.keyId })
    .setIssuer(env.apple.teamId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  cached = { token, exp };
  return token;
}

export async function appleCatalogSearch(term: string, limit = 20): Promise<Song[]> {
  const token = await getDeveloperToken();
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
