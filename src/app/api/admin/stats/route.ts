import { notFound } from "@/lib/errors";
import { getDashboard, isPlatformAdmin } from "@/lib/services/analytics";
import { api, currentHostId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Live numbers for the owner dashboard. Only platform admins get an answer. */
export const GET = api(async (req: Request) => {
  if (!(await isPlatformAdmin(await currentHostId()))) throw notFound();
  return getDashboard(new URL(req.url).searchParams.get("tz"));
});
