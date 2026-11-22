import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security";
import { createRecoveryCode } from "@/lib/services/recoveryCode";
import { api, assertSameOrigin, requireHostId } from "@/lib/session";

/** Signed-in host makes a new recovery code (replaces the old one). Shown once. */
export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  if (!(await rateLimit(`recovery-code:${hostId}`, 10, 3600))) {
    throw new AppError(429, "Too many new codes. Wait an hour.", "rate_limited");
  }
  return { code: await createRecoveryCode(hostId) };
});
