import { deleteEvent, setLivePlaylistId, updateEvent } from "@/lib/services/events";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const hostId = await requireHostId();
  const b = await readJson(req);
  if (b.liveApplePlaylistId !== undefined && Object.keys(b).length === 1) {
    await setLivePlaylistId(hostId, (await ctx.params).id, b.liveApplePlaylistId ? String(b.liveApplePlaylistId) : null);
    return { ok: true };
  }
  await updateEvent(hostId, (await ctx.params).id, {
    name: String(b.name ?? ""),
    venueName: b.venueName ? String(b.venueName) : null,
    description: b.description ? String(b.description) : null,
    startsAt: b.startsAt ? String(b.startsAt) : null,
    replayAppleUrl: b.replayAppleUrl === undefined ? undefined : b.replayAppleUrl ? String(b.replayAppleUrl) : null,
  });
  return { ok: true };
});

export const DELETE = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  await deleteEvent(await requireHostId(), (await ctx.params).id);
  return { ok: true };
});
