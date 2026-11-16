import { notFound } from "@/lib/errors";
import { normalizeSettings } from "@/lib/ranking";
import { getEventById } from "@/lib/services/events";
import { listPeople } from "@/lib/services/guests";
import { requireEventRole } from "@/lib/services/hosts";
import { getEventLog, getSnapshot } from "@/lib/services/queue";
import { sql } from "@/lib/db";
import { api, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

/** Everything the host dashboard needs, including ranking scores and removed songs. */
export const GET = api(async (_req: Request, ctx: Ctx) => {
  const hostId = await requireHostId();
  const id = (await ctx.params).id;
  const role = await requireEventRole(hostId, id);
  const event = await getEventById(id);
  if (!event) throw notFound();
  const [snapshot, people, log, hidden] = await Promise.all([
    getSnapshot(event),
    listPeople(id),
    getEventLog(hostId, id, 40),
    sql`select id, title, artist, status from queue_items where event_id = ${id} and status in ('skipped','removed')
        order by coalesce(finished_at, created_at) desc limit 50`,
  ]);
  return {
    role,
    snapshot,
    settings: normalizeSettings(event.settings),
    people,
    log,
    hidden,
    liveApplePlaylistId: event.live_apple_playlist_id,
  };
});
