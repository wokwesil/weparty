import { toCsv } from "@/lib/csv";
import { notFound } from "@/lib/errors";
import { flags } from "@/lib/flags";
import { listFollowers } from "@/lib/services/growth";
import { api, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ orgId: string }> };

/** Download the people who asked to hear about your next party (CSV). */
export const GET = api(async (_req: Request, ctx: Ctx) => {
  if (!flags.growth) throw notFound();
  const rows = await listFollowers(await requireHostId(), (await ctx.params).orgId);
  const body = toCsv([
    ["Email", "Instagram", "Followed on", "From party"],
    ...rows.map((r) => [r.email, r.instagram_username ? `@${r.instagram_username}` : "", r.created_at.toISOString().slice(0, 10), r.event_name ?? ""]),
  ]);
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="weparty-followers.csv"', "Cache-Control": "no-store" },
  });
});
