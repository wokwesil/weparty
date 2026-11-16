import { notFound } from "@/lib/errors";
import { getEventById } from "@/lib/services/events";
import { requireEventRole } from "@/lib/services/hosts";
import { getSnapshot } from "@/lib/services/queue";
import { api, requireHostId } from "@/lib/session";
import type { SongView } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Exports for DJs and other apps:
 *   ?list=queue   upcoming songs in WeParty order (default)
 *   ?list=played  songs actually played, in real order
 *   ?format=csv | txt | json
 * The .txt "Artist - Title" list can be pasted into playlist-transfer tools.
 */
export const GET = api(async (req: Request, ctx: Ctx) => {
  const hostId = await requireHostId();
  const id = (await ctx.params).id;
  await requireEventRole(hostId, id);
  const event = await getEventById(id);
  if (!event) throw notFound();
  const params = new URL(req.url).searchParams;
  const list = params.get("list") === "played" ? "played" : "queue";
  const format = (["csv", "txt", "json"] as const).find((f) => f === params.get("format")) ?? "csv";
  const snap = await getSnapshot(event);
  const songs: SongView[] =
    list === "played"
      ? [...snap.history, ...(snap.nowPlaying ? [snap.nowPlaying] : [])].sort((a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0))
      : [...(snap.nowPlaying ? [snap.nowPlaying] : []), ...snap.queue];
  const filename = `weparty-${event.code}-${list}.${format}`;
  const disposition = { "Content-Disposition": `attachment; filename="${filename}"` };

  if (format === "json") {
    return new Response(JSON.stringify({ event: snap.event, list, songs }, null, 2), {
      headers: { "Content-Type": "application/json", ...disposition },
    });
  }
  if (format === "txt") {
    const body = songs.map((s) => `${s.artist} - ${s.title}`).join("\n") + "\n";
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", ...disposition } });
  }
  const header = ["#", "Title", "Artist", "Album", "Hearts", "Requests", "Requested by", "Instagram", "Apple Music ID", "Apple Music link", "Status"];
  const rows = songs.map((s, i) => [
    i + 1, s.title, s.artist, s.album, s.votes, s.requests,
    s.requester?.displayName ?? (s.addedByHost ? "Host" : ""),
    s.requester ? `@${s.requester.instagram}` : "",
    s.appleSongId, s.appleUrl, s.status,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", ...disposition } });
});
