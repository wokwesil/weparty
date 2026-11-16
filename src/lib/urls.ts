import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

/** The public web address of the app (used in QR codes and share links). */
export async function baseUrl() {
  if (env.appUrl) return env.appUrl;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function eventJoinUrl(code: string) {
  return `${await baseUrl()}/e/${code}`;
}
