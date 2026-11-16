import { requireEventByCode } from "@/lib/services/events";
import { deleteGuestSelf, toPerson, updateGuestProfile } from "@/lib/services/guests";
import { getGuestActivity } from "@/lib/services/queue";
import { api, assertSameOrigin, clearGuestCookie, readJson, requireGuest } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";

export const GET = api(async (_req: Request, ctx: Ctx) => {
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  const activity = await getGuestActivity(guest.id);
  return { me: { ...toPerson(guest), ...activity, songsSubmitted: activity.mySongIds.length } };
});

export const PATCH = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  const body = await readJson(req);
  const g = await updateGuestProfile(guest, {
    displayName: body.displayName === undefined ? undefined : String(body.displayName),
    instagram: body.instagram === undefined ? undefined : String(body.instagram),
  });
  return { me: toPerson(g) };
});

/** Guest deletes their own info from this party (profile, photo, hearts, song picks). */
export const DELETE = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const event = await requireEventByCode((await ctx.params).code);
  const guest = await requireGuest(event);
  await deleteGuestSelf(guest);
  await clearGuestCookie(event.id);
  return { ok: true };
});
