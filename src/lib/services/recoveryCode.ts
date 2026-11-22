import "server-only";
import crypto from "node:crypto";
import { sql } from "../db";
import { badRequest, unauthorized } from "../errors";
import { hashPassword, verifyPassword } from "../security";

/**
 * Recovery codes let a host reset their own password with no email service:
 * email + recovery code + new password. Each code works once; using it gives
 * the host a fresh one. Only a hash is stored, like a password.
 */

// No 0/O, 1/I/L, so codes are easy to read and type. 16 characters from 31 = about 79 bits.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode() {
  const chars = Array.from({ length: 16 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]);
  return chars.join("").match(/.{4}/g)!.join("-");
}

/** Upper-cases and drops spaces/dashes, so "abcd-efgh ..." and "ABCDEFGH..." both work. */
export function normalizeRecoveryCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 64);
}

/** Makes a new recovery code for a host, replacing any old one. Returns it (shown once). */
export async function createRecoveryCode(hostId: string) {
  const code = generateRecoveryCode();
  await sql`update hosts set recovery_code_hash = ${await hashPassword(normalizeRecoveryCode(code))},
            recovery_code_created_at = now() where id = ${hostId}`;
  return code;
}

export async function hasRecoveryCode(hostId: string) {
  const [row] = await sql<{ ok: boolean }[]>`select recovery_code_hash is not null as ok from hosts where id = ${hostId}`;
  return Boolean(row?.ok);
}

const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

/** Email + recovery code + new password. Returns the host id and their next recovery code. */
export async function resetPasswordWithRecoveryCode(emailRaw: string, codeRaw: string, newPassword: string) {
  if (newPassword.length < 8) throw badRequest("Password must be at least 8 characters.");
  const email = emailRaw.trim().toLowerCase();
  const [row] = await sql<{ id: string; recovery_code_hash: string | null }[]>`
    select id, recovery_code_hash from hosts where lower(email) = ${email}`;
  // Always run a hash check so timing doesn't reveal which emails exist.
  const ok = await verifyPassword(normalizeRecoveryCode(codeRaw), row?.recovery_code_hash ?? DUMMY_HASH);
  if (!row || !row.recovery_code_hash || !ok) throw unauthorized("That email and recovery code don't match.");
  const nextCode = generateRecoveryCode();
  const [pwHash, codeHash] = await Promise.all([hashPassword(newPassword), hashPassword(normalizeRecoveryCode(nextCode))]);
  // Only if the code is still the one we checked (stops using the same code twice at once).
  const updated = await sql`
    update hosts set password_hash = ${pwHash}, recovery_code_hash = ${codeHash},
      recovery_code_created_at = now(), last_login_at = now()
    where id = ${row.id} and recovery_code_hash = ${row.recovery_code_hash} returning id`;
  if (!updated.length) throw unauthorized("That email and recovery code don't match.");
  return { hostId: row.id, nextCode };
}
