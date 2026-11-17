import { addBlock, listBlocks, removeBlock } from "@/lib/services/dj";
import { requireEventRole } from "@/lib/services/hosts";
import { api, assertSameOrigin, readJson, requireHostId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = api(async (_req: Request, ctx: Ctx) => {
  const hostId = await requireHostId();
  const id = (await ctx.params).id;
  await requireEventRole(hostId, id);
  return { blocks: await listBlocks(id) };
});

export const POST = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const b = await readJson(req);
  return addBlock(await requireHostId(), (await ctx.params).id, {
    kind: String(b.kind ?? ""),
    value: b.value === undefined ? undefined : String(b.value),
    label: b.label === undefined ? undefined : String(b.label),
  });
});

export const DELETE = api(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const blockId = new URL(req.url).searchParams.get("blockId") ?? "";
  await removeBlock(await requireHostId(), (await ctx.params).id, blockId);
  return { ok: true };
});
