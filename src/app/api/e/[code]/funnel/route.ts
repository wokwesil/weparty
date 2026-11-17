import { requireEventByCode } from "@/lib/services/events";
import { recordFunnel } from "@/lib/services/dj";
import { api, assertSameOrigin, readJson } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/** Join drop-off tracking: scanned → profile → picked → joined (anonymous per-phone id). */
export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const b = await readJson(req);
  await recordFunnel(event.id, String(b.device ?? ""), String(b.step ?? ""));
  return { ok: true };
});
