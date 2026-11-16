import { badRequest } from "@/lib/errors";
import { addOrgMember } from "@/lib/services/hosts";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ orgId: string }> };

/** Invite another host account (e.g. a DJ) to help run this account's events. */
export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  const role = b.role === "admin" ? "admin" : b.role === "dj" ? "dj" : null;
  if (!role) throw badRequest("Role must be admin or dj.");
  await addOrgMember(await requireHostId(), (await ctx.params).orgId, String(b.email ?? ""), role);
  return { ok: true };
});
