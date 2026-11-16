import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { loginHost } from "@/lib/services/hosts";
import { api, assertSameOrigin, readJson, setHostCookie } from "@/lib/session";

export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  const email = String(b.email ?? "").toLowerCase();
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`login:${ip}`, 30, 900)) || !(await rateLimit(`login:${email}`, 10, 900))) {
    throw new AppError(429, "Too many sign-in attempts. Wait 15 minutes.", "rate_limited");
  }
  const id = await loginHost(email, String(b.password ?? ""));
  await setHostCookie(id);
  return { ok: true };
});
