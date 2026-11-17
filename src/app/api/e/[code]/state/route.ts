import { AppError } from "@/lib/errors";
import { flags } from "@/lib/flags";
import { requireEventByCode } from "@/lib/services/events";
import { toPerson } from "@/lib/services/guests";
import { requireEventRole } from "@/lib/services/hosts";
import { cloneSnapshot, getGuestActivity, getSnapshot } from "@/lib/services/queue";
import { api, currentGuest, currentHostId } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

/** The live party: now playing, ranked queue, history. Only for guests of this party (or its host). */
export const GET = api(async (_req: Request, ctx: Ctx) => {
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await currentGuest(event);
  if (!guest) {
    const hostId = await currentHostId();
    const isHost = hostId ? await requireEventRole(hostId, event.id).then(() => true, () => false) : false;
    if (!isHost) throw new AppError(401, "Join the party first.", "not_joined");
  }
  const [shared, activity] = await Promise.all([
    getSnapshot(event),
    guest ? getGuestActivity(guest.id) : Promise.resolve({ votedIds: [], mySongIds: [], myPending: [] }),
  ]);
  const snapshot = cloneSnapshot(shared);
  // Guests don't need the internal ranking scores or other people's pending requests.
  for (const s of snapshot.queue) s.score = null;
  snapshot.pending = [];
  return {
    ...snapshot,
    me: guest ? { ...toPerson(guest), ...activity, songsSubmitted: activity.mySongIds.length } : null,
    growth: flags.growth,
  };
});
