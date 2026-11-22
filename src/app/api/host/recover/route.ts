import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { resetPasswordWithRecoveryCode } from "@/lib/services/recoveryCode";
import { api, assertSameOrigin, readJson, setHostCookie } from "@/lib/session";

/** Host resets their password with email + recovery code, then is signed in. */
export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`recover:${ip}`, 20, 3600)) || !(await rateLimit(`recover:${email}`, 5, 3600))) {
    throw new AppError(429, "Too many tries. Wait an hour, or ask the We Party team for help.", "rate_limited");
  }
  const { hostId, nextCode } = await resetPasswordWithRecoveryCode(email, String(b.code ?? ""), String(b.password ?? ""));
  await setHostCookie(hostId);
  return { ok: true, nextCode };
});
