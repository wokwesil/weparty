import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { sql } from "../db";
import { env, requireSessionSecret } from "../env";
import { badRequest } from "../errors";
import { hashPassword, sha256 } from "../security";
import { emailConfigured, sendEmail } from "./mailer";

export { emailConfigured };

/**
 * "Forgot password" for hosts.
 *
 * The reset link holds a signed token that lasts 1 hour. It also holds a
 * fingerprint of the host's current password, so the link stops working the
 * moment the password changes (each link works once). No database table needed.
 */
const RESET_MINUTES = 60;

const key = () => new TextEncoder().encode(requireSessionSecret());
const fingerprint = (passwordHash: string) => sha256(`reset:${passwordHash}`).slice(0, 32);

export async function createResetToken(hostId: string, passwordHash: string) {
  return new SignJWT({ typ: "pw-reset", fp: fingerprint(passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(hostId)
    .setIssuedAt()
    .setExpirationTime(`${RESET_MINUTES}m`)
    .sign(key());
}

const expired = () => badRequest("This reset link has expired or was already used. Ask for a new one.", "reset_expired");

/** Checks a reset token and sets the new password. Returns the host id. */
export async function resetPasswordWithToken(token: string, newPassword: string) {
  if (newPassword.length < 8) throw badRequest("Password must be at least 8 characters.");
  let hostId: string;
  let fp: unknown;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "pw-reset" || typeof payload.sub !== "string") throw expired();
    hostId = payload.sub;
    fp = payload.fp;
  } catch {
    throw expired();
  }
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from hosts where id = ${hostId}`;
  if (!row || fp !== fingerprint(row.password_hash)) throw expired();
  const hash = await hashPassword(newPassword);
  // Only update if the password is still the one the link was made for (stops double use).
  const updated = await sql`update hosts set password_hash = ${hash}, last_login_at = now()
                            where id = ${hostId} and password_hash = ${row.password_hash} returning id`;
  if (!updated.length) throw expired();
  return hostId;
}

/** Makes a fresh reset link for a host email, or null if there is no such host. */
export async function resetLinkForEmail(emailRaw: string, baseUrl: string) {
  const email = emailRaw.trim().toLowerCase();
  const [row] = await sql<{ id: string; password_hash: string; display_name: string; email: string }[]>`
    select id, password_hash, display_name, email from hosts where lower(email) = ${email}`;
  if (!row) return null;
  const token = await createResetToken(row.id, row.password_hash);
  return { link: `${baseUrl}/host/reset#${token}`, displayName: row.display_name, email: row.email };
}

/**
 * Emails a reset link if the host exists. Never says whether the email has an
 * account, so nobody can use this page to find out who hosts on WeParty.
 */
export async function requestPasswordReset(emailRaw: string, baseUrl: string) {
  const found = await resetLinkForEmail(emailRaw, baseUrl);
  if (!found) return;
  if (!emailConfigured()) {
    // No email service yet. The site owner can make a link on /admin instead.
    console.warn(`[password-reset] Email is not set up, so no email was sent to ${found.email}. Make a link on /admin.`);
    return;
  }
  await sendEmail({
    to: found.email,
    subject: "Reset your We Party password",
    text:
      `Hi ${found.displayName},\n\n` +
      `Someone (hopefully you) asked to reset your We Party host password.\n\n` +
      `Choose a new password here (this link works once, for ${RESET_MINUTES} minutes):\n${found.link}\n\n` +
      `If you didn't ask for this, you can ignore this email. Your password won't change.`,
  });
}

export function resetBaseUrl(req: Request) {
  return env.appUrl || new URL(req.url).origin;
}
