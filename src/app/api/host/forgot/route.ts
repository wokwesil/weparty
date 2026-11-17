import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { requestPasswordReset, resetBaseUrl } from "@/lib/services/passwordReset";
import { api, assertSameOrigin, readJson } from "@/lib/session";

/** Host asks for a password reset link. Always answers the same way. */
export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`forgot:${ip}`, 10, 900)) || !(await rateLimit(`forgot:${email}`, 3, 900))) {
    throw new AppError(429, "Too many reset requests. Wait 15 minutes.", "rate_limited");
  }
  if (email) await requestPasswordReset(email, resetBaseUrl(req));
  return { ok: true };
});
