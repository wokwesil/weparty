import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { resetPasswordWithToken } from "@/lib/services/passwordReset";
import { api, assertSameOrigin, readJson, setHostCookie } from "@/lib/session";

/** Host sets a new password using the link from their email, then is signed in. */
export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`reset:${ip}`, 20, 900))) {
    throw new AppError(429, "Too many attempts. Wait 15 minutes.", "rate_limited");
  }
  const hostId = await resetPasswordWithToken(String(b.token ?? ""), String(b.password ?? ""));
  await setHostCookie(hostId);
  return { ok: true };
});
