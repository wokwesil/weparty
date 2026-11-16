import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "./env";
import { AppError, unauthorized } from "./errors";
import { signHostSession, verifyHostSession } from "./security";
import { getGuestByToken } from "./services/guests";
import type { EventRow } from "./services/events";

const HOST_COOKIE = "wp_host";
const guestCookie = (eventId: string) => `wp_guest_${eventId.replace(/-/g, "")}`;

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.isProd,
  path: "/",
};

export async function setHostCookie(hostId: string) {
  (await cookies()).set(HOST_COOKIE, await signHostSession(hostId), { ...baseCookie, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearHostCookie() {
  (await cookies()).delete(HOST_COOKIE);
}

export async function currentHostId() {
  return verifyHostSession((await cookies()).get(HOST_COOKIE)?.value);
}

export async function requireHostId() {
  const id = await currentHostId();
  if (!id) throw unauthorized("Please sign in as a host.");
  return id;
}

export async function setGuestCookie(eventId: string, token: string) {
  (await cookies()).set(guestCookie(eventId), token, { ...baseCookie, maxAge: 60 * 60 * 24 * 60 });
}

export async function currentGuest(event: EventRow) {
  return getGuestByToken(event.id, (await cookies()).get(guestCookie(event.id))?.value);
}

export async function requireGuest(event: EventRow) {
  const g = await currentGuest(event);
  if (!g) throw new AppError(401, "Join the party first.", "not_joined");
  return g;
}

/** Wraps an API route so errors become friendly JSON messages. */
export function api<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const result = await fn(...args);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong. Please try again.", code: "server_error" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Blocks cross-site form posts (CSRF): mutating requests must come from our own pages. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from some browsers omit it; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new AppError(403, "Cross-site request blocked.", "csrf");
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(403, "Cross-site request blocked.", "csrf");
  }
}
