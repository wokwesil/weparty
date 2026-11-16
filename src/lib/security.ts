import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { requireSessionSecret } from "./env";
import { sql } from "./db";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(key, expected);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function randomEventCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function secretKey() {
  return new TextEncoder().encode(requireSessionSecret());
}

export async function signHostSession(hostId: string) {
  return new SignJWT({ sub: hostId, typ: "host" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifyHostSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.typ !== "host" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Simple fixed-window rate limit stored in Postgres. Returns true when allowed. */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number) {
  const rows = await sql<{ hits: number }[]>`
    insert into rate_limits (bucket, hits, window_start)
    values (${bucket}, 1, now())
    on conflict (bucket) do update set
      hits = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                  then 1 else rate_limits.hits + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                  then now() else rate_limits.window_start end
    returning hits`;
  return rows[0].hits <= limit;
}

/** Turns "@Name", "instagram.com/name/" etc. into "name". Returns null if invalid. */
export function normalizeInstagram(input: string): string | null {
  let v = input.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "").replace(/^(www\.)?instagram\.com\//, "");
  v = v.split(/[/?#]/)[0].replace(/^@/, "");
  if (!/^[a-z0-9._]{1,30}$/.test(v)) return null;
  if (v.startsWith(".") || v.endsWith(".") || v.includes("..")) return null;
  return v;
}
