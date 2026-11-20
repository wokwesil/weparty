import { badRequest, notFound } from "@/lib/errors";
import { isPlatformAdmin } from "@/lib/services/analytics";
import { emailConfigured, resetBaseUrl, resetLinkForEmail } from "@/lib/services/passwordReset";
import { api, assertSameOrigin, currentHostId, readJson } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Owner only: make a one-time password reset link for any host, to send them by text or DM.
 * Works even when reset emails aren't switched on.
 */
export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  if (!(await isPlatformAdmin(await currentHostId()))) throw notFound();
  const b = await readJson(req);
  const email = String(b.email ?? "").trim().slice(0, 200);
  if (!email) throw badRequest("Type the host's email.");
  const found = await resetLinkForEmail(email, resetBaseUrl(req));
  if (!found) throw badRequest("No host account uses that email.", "no_such_host");
  return { link: found.link, name: found.displayName, email: found.email, emailReady: emailConfigured() };
});
