import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { signupHost } from "@/lib/services/hosts";
import { api, assertSameOrigin, readJson, setHostCookie } from "@/lib/session";

export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`signup:${ip}`, 10, 3600))) throw new AppError(429, "Too many attempts. Try later.", "rate_limited");
  const b = await readJson(req);
  const id = await signupHost({
    email: String(b.email ?? ""),
    password: String(b.password ?? ""),
    displayName: String(b.displayName ?? ""),
    orgName: b.orgName ? String(b.orgName) : undefined,
    orgKind: b.orgKind ? String(b.orgKind) : undefined,
    inviteCode: b.inviteCode ? String(b.inviteCode) : undefined,
  });
  await setHostCookie(id);
  return { ok: true };
});
