import { getAvatar } from "@/lib/services/guests";

type Ctx = { params: Promise<{ guestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const a = await getAvatar((await ctx.params).guestId);
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
