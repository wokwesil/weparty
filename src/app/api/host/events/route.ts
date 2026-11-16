import { createEvent, listHostEvents } from "@/lib/services/events";
import { getHostAccount } from "@/lib/services/hosts";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";
import { badRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = api(async () => ({ events: await listHostEvents(await requireHostId()) }));

export const POST = api(async (req: Request) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  const b = await readJson(req);
  const account = await getHostAccount(hostId);
  const orgId = b.orgId ? String(b.orgId) : account?.orgs.find((o) => o.role !== "dj")?.id;
  if (!orgId) throw badRequest("No account to create the event under.");
  const id = await createEvent(hostId, orgId, {
    name: String(b.name ?? ""),
    venueName: b.venueName ? String(b.venueName) : null,
    description: b.description ? String(b.description) : null,
    startsAt: b.startsAt ? String(b.startsAt) : null,
  });
  return { id };
});
