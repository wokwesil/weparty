import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { deleteHostAccount } from "@/lib/services/hosts";
import { api, assertSameOrigin, clearHostCookie, readJson, requireHostId } from "@/lib/session";

/** Host permanently deletes their account (password required). */
export const DELETE = api(async (req: Request) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  if (!(await rateLimit(`delete-account:${hostId}`, 5, 900))) {
    throw new AppError(429, "Too many attempts. Wait 15 minutes.", "rate_limited");
  }
  const body = await readJson(req);
  await deleteHostAccount(hostId, String(body.password ?? ""));
  await clearHostCookie();
  return { ok: true };
});
