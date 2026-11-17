import { getEventByCode } from "@/lib/services/events";
import { getDjPhoto } from "@/lib/services/dj";

type Ctx = { params: Promise<{ code: string }> };

/** The DJ Spotlight photo (public, like the replay page). */
export async function GET(_req: Request, ctx: Ctx) {
  const event = await getEventByCode((await ctx.params).code);
  const p = event ? await getDjPhoto(event.id) : null;
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.data), {
    headers: { "Content-Type": p.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
