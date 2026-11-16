import { getEventByCode } from "@/lib/services/events";
import { getReplay } from "@/lib/services/queue";

type Ctx = { params: Promise<{ code: string }> };

/** Plain "Artist - Title" list of the songs played. Works with playlist-transfer tools for other services. */
export async function GET(_req: Request, ctx: Ctx) {
  const event = await getEventByCode((await ctx.params).code);
  const replay = event ? await getReplay(event.id) : null;
  if (!event || !replay) return new Response("Not found", { status: 404 });
  const lines = [`${event.name} · WeParty Replay`, "", ...replay.played.map((s, i) => `${i + 1}. ${s.artist} - ${s.title}`), ""];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="weparty-${event.code}-replay.txt"`,
    },
  });
}
