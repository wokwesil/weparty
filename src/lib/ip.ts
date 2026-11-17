import "server-only";
import { headers } from "next/headers";

/** The visitor's IP address (first entry of x-forwarded-for on Vercel). */
export async function clientIp() {
  return ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

/** Random per-phone id the browser sends (not personal data; used for fair rate limits on shared venue Wi-Fi). */
export async function deviceId() {
  const d = (await headers()).get("x-wp-device") ?? "";
  return /^[A-Za-z0-9_-]{8,64}$/.test(d) ? d : null;
}
