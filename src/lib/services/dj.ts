import "server-only";
import { sql } from "../db";
import { appleMusicConfigured, env, realtimeConfigured } from "../env";
import { badRequest, notFound } from "../errors";
import { blockMatch, normalizeArtist, type BlockEntry } from "../blocklist";
import { normalizeSettings } from "../ranking";
import { notifyEventChanged } from "../realtime";
import { rateLimit } from "../security";
import { effectiveApproval, getEventById, logEvent, type EventRow } from "./events";
import { sniffMime, type GuestRow } from "./guests";
import { requireEventRole } from "./hosts";

/* ------------------------------------------------------------------------ */
/* Blocklist                                                                 */
/* ------------------------------------------------------------------------ */

export type BlockRow = BlockEntry & { id: string; createdAt: string };

export async function listBlocks(eventId: string): Promise<BlockRow[]> {
  const rows = await sql<{ id: string; kind: "song" | "artist"; value: string; label: string; created_at: Date }[]>`
    select id, kind, value, label, created_at from event_blocklist where event_id = ${eventId} order by created_at desc`;
  return rows.map((r) => ({ id: r.id, kind: r.kind, value: r.value, label: r.label, createdAt: r.created_at.toISOString() }));
}

/**
 * DJ blocks a song or an artist. Matching songs that haven't played yet
 * leave the queue (and the pending list) right away.
 */
export async function addBlock(hostId: string, eventId: string, input: { kind: string; value?: string; label?: string }) {
  await requireEventRole(hostId, eventId, "dj");
  const kind = input.kind === "song" ? "song" : input.kind === "artist" ? "artist" : null;
  if (!kind) throw badRequest("Block a song or an artist.");
  const label = String(input.label ?? input.value ?? "").trim().slice(0, 300);
  const value = kind === "artist" ? normalizeArtist(String(input.value ?? label)).slice(0, 300) : String(input.value ?? "").trim();
  if (!value || !label) throw badRequest(kind === "artist" ? "Type the artist's name." : "Pick a song to block.");
  if (kind === "song" && !/^[A-Za-z0-9.:_-]{1,64}$/.test(value)) throw badRequest("That song can't be blocked.");
  let removed = 0;
  await sql.begin(async (tx) => {
    await tx`insert into event_blocklist (event_id, kind, value, label) values (${eventId}, ${kind}, ${value}, ${label})
             on conflict (event_id, kind, value) do nothing`;
    const open = await tx<{ id: string; apple_song_id: string; artist: string }[]>`
      select id, apple_song_id, artist from queue_items where event_id = ${eventId} and status in ('queued','pending')`;
    const hits = open.filter((i) => blockMatch({ appleId: i.apple_song_id, artist: i.artist }, [{ kind, value, label }]));
    if (hits.length) {
      await tx`update queue_items set status = 'removed', pinned_rank = null where id in ${tx(hits.map((h) => h.id))}`;
    }
    removed = hits.length;
  });
  await logEvent(eventId, `host:${hostId}`, "blocklist_added", { kind, title: label, removed });
  await notifyEventChanged(eventId);
  return { removed };
}

export async function removeBlock(hostId: string, eventId: string, blockId: string) {
  await requireEventRole(hostId, eventId, "dj");
  if (!/^[0-9a-f-]{36}$/i.test(blockId)) throw badRequest("Bad id.");
  await sql`delete from event_blocklist where id = ${blockId} and event_id = ${eventId}`;
  await notifyEventChanged(eventId);
}

/* ------------------------------------------------------------------------ */
/* Shoutouts                                                                 */
/* ------------------------------------------------------------------------ */

export async function postShoutout(hostId: string, eventId: string, raw: string) {
  await requireEventRole(hostId, eventId, "dj");
  const message = raw.trim().replace(/\s+/g, " ").slice(0, 140);
  if (!message) throw badRequest("Write a short message first.");
  if (!(await rateLimit(`shout:${eventId}`, 10, 60))) throw badRequest("That's a lot of shoutouts! Wait a minute.", "rate_limited");
  const [row] = await sql<{ id: number }[]>`
    insert into event_shoutouts (event_id, message, created_by) values (${eventId}, ${message}, ${hostId}) returning id`;
  await logEvent(eventId, `host:${hostId}`, "shoutout", { title: message });
  await notifyEventChanged(eventId, "shoutout");
  return { id: row.id };
}

/** Takes the current shoutout off guests' screens. */
export async function clearShoutouts(hostId: string, eventId: string) {
  await requireEventRole(hostId, eventId, "dj");
  await sql`delete from event_shoutouts where event_id = ${eventId} and created_at > now() - interval '15 minutes'`;
  await notifyEventChanged(eventId, "shoutout");
}

/* ------------------------------------------------------------------------ */
/* DJ Spotlight photo                                                        */
/* ------------------------------------------------------------------------ */

export async function setDjPhoto(hostId: string, eventId: string, data: Buffer) {
  await requireEventRole(hostId, eventId, "dj");
  if (data.length === 0) throw badRequest("That photo is empty.");
  if (data.length > 400_000) throw badRequest("That photo is too large. Try a smaller one.");
  const mime = sniffMime(data);
  if (!mime) throw badRequest("Please upload a JPEG, PNG or WebP photo.");
  await sql.begin(async (tx) => {
    await tx`insert into event_dj_photos (event_id, mime, data) values (${eventId}, ${mime}, ${data})
             on conflict (event_id) do update set mime = excluded.mime, data = excluded.data, updated_at = now()`;
    await tx`update events set dj_photo_version = dj_photo_version + 1 where id = ${eventId}`;
  });
  await notifyEventChanged(eventId);
}

export async function getDjPhoto(eventId: string) {
  const [p] = await sql<{ mime: string; data: Buffer }[]>`select mime, data from event_dj_photos where event_id = ${eventId}`;
  return p ?? null;
}

/* ------------------------------------------------------------------------ */
/* Crowd Pulse: suggestions for the DJ (the DJ decides)                      */
/* ------------------------------------------------------------------------ */

export type CrowdPulse = {
  trending: { id: string; title: string; artist: string; artworkUrl: string | null; status: string; recentHearts: number; recentRequests: number }[];
  topArtists: { artist: string; hearts: number; requests: number }[];
  genres: { genre: string; requests: number }[];
  activity: { at: string; requests: number; hearts: number }[];
};

export async function getCrowdPulse(eventId: string): Promise<CrowdPulse> {
  const [trending, artists, genres, activity] = await Promise.all([
    sql<{ id: string; title: string; artist: string; artwork_url: string | null; status: string; hearts: number; requests: number }[]>`
      with recent as (
        select queue_item_id, 1 as h, 0 as r from votes where event_id = ${eventId} and created_at > now() - interval '30 minutes'
        union all
        select queue_item_id, 0, 1 from song_requests where event_id = ${eventId} and created_at > now() - interval '30 minutes'
      )
      select q.id, q.title, q.artist, q.artwork_url, q.status, sum(recent.h)::int as hearts, sum(recent.r)::int as requests
      from recent join queue_items q on q.id = recent.queue_item_id
      where q.status in ('queued','pending')
      group by q.id order by sum(recent.h) + 2 * sum(recent.r) desc, max(q.created_at) desc limit 8`,
    sql<{ artist: string; hearts: number; requests: number }[]>`
      select q.artist,
             coalesce(sum((select count(*) from votes v where v.queue_item_id = q.id)), 0)::int as hearts,
             coalesce(sum((select count(*) from song_requests r where r.queue_item_id = q.id)), 0)::int as requests
      from queue_items q where q.event_id = ${eventId} and q.status not in ('removed','declined')
      group by q.artist order by 2 desc, 3 desc limit 8`,
    sql<{ genre: string; requests: number }[]>`
      select q.genre, count(r.*)::int as requests
      from queue_items q join song_requests r on r.queue_item_id = q.id
      where q.event_id = ${eventId} and q.genre is not null and q.status not in ('removed','declined')
      group by q.genre order by 2 desc limit 6`,
    sql<{ bucket: Date; requests: number; hearts: number }[]>`
      with ev as (
        select date_bin('5 minutes', created_at, timestamptz '2000-01-01') as bucket, 1 as r, 0 as h
          from song_requests where event_id = ${eventId} and created_at > now() - interval '2 hours'
        union all
        select date_bin('5 minutes', created_at, timestamptz '2000-01-01'), 0, 1
          from votes where event_id = ${eventId} and created_at > now() - interval '2 hours'
      )
      select bucket, sum(r)::int as requests, sum(h)::int as hearts from ev group by bucket order by bucket`,
  ]);
  return {
    trending: trending
      .filter((t) => t.hearts + t.requests > 0)
      .map((t) => ({ id: t.id, title: t.title, artist: t.artist, artworkUrl: t.artwork_url, status: t.status, recentHearts: t.hearts, recentRequests: t.requests })),
    topArtists: artists.filter((a) => a.hearts + a.requests > 0),
    genres: [...genres],
    activity: activity.map((a) => ({ at: a.bucket.toISOString(), requests: a.requests, hearts: a.hearts })),
  };
}

/* ------------------------------------------------------------------------ */
/* Guest reports                                                             */
/* ------------------------------------------------------------------------ */

export async function reportGuest(event: EventRow, reporter: GuestRow, guestId: string, reasonRaw: string) {
  if (!/^[0-9a-f-]{36}$/i.test(guestId)) throw badRequest("Pick someone to report.");
  if (guestId === reporter.id) throw badRequest("You can't report yourself.");
  const reason = reasonRaw.trim().slice(0, 300) || "No reason given";
  if (!(await rateLimit(`report:${reporter.id}`, 5, 3600))) {
    throw badRequest("You've sent a lot of reports. The host has them.", "rate_limited");
  }
  const [target] = await sql`select 1 from guests where id = ${guestId} and event_id = ${event.id}`;
  if (!target) throw notFound("That guest isn't at this party.");
  await sql`insert into guest_reports (event_id, reporter_id, guest_id, reason)
            values (${event.id}, ${reporter.id}, ${guestId}, ${reason})
            on conflict (reporter_id, guest_id) do update set reason = excluded.reason, created_at = now()`;
  await logEvent(event.id, `guest:${reporter.id}`, "guest_reported", {});
  return { ok: true };
}

export async function listReports(eventId: string) {
  const rows = await sql<{ id: number; guest_id: string; reason: string; created_at: Date }[]>`
    select id, guest_id, reason, created_at from guest_reports where event_id = ${eventId} order by created_at desc limit 100`;
  return rows.map((r) => ({ id: r.id, guestId: r.guest_id, reason: r.reason, createdAt: r.created_at.toISOString() }));
}

/* ------------------------------------------------------------------------ */
/* Join drop-off tracking                                                    */
/* ------------------------------------------------------------------------ */

export const FUNNEL_STEPS = ["scanned", "profile", "picked", "joined"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export async function recordFunnel(eventId: string, device: string, step: string) {
  if (!(FUNNEL_STEPS as readonly string[]).includes(step)) throw badRequest("Unknown step.");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(device)) throw badRequest("Bad device id.");
  if (!(await rateLimit(`funnel:${device}`, 30, 600))) return;
  await sql`insert into join_funnel (event_id, device, step) values (${eventId}, ${device}, ${step}) on conflict do nothing`;
}

export type FunnelStats = {
  steps: { step: FunnelStep; label: string; count: number }[];
  medianSecondsToJoin: number | null;
  under30s: number;
};

export async function getFunnel(eventId: string): Promise<FunnelStats> {
  const [counts, timing] = await Promise.all([
    sql<{ step: FunnelStep; n: number }[]>`select step, count(*)::int as n from join_funnel where event_id = ${eventId} group by step`,
    sql<{ secs: number }[]>`
      select extract(epoch from j.created_at - s.created_at)::float as secs
      from join_funnel s join join_funnel j on j.event_id = s.event_id and j.device = s.device and j.step = 'joined'
      where s.event_id = ${eventId} and s.step = 'scanned' and j.created_at >= s.created_at`,
  ]);
  const map = new Map(counts.map((c) => [c.step, c.n]));
  const labels: Record<FunnelStep, string> = {
    scanned: "Opened the party link",
    profile: "Added their profile",
    picked: "Picked a song",
    joined: "In the party",
  };
  const secs = timing.map((t) => t.secs).sort((a, b) => a - b);
  return {
    steps: FUNNEL_STEPS.map((step) => ({ step, label: labels[step], count: map.get(step) ?? 0 })),
    medianSecondsToJoin: secs.length ? Math.round(secs[Math.floor(secs.length / 2)]) : null,
    under30s: secs.filter((s) => s <= 30).length,
  };
}

/* ------------------------------------------------------------------------ */
/* Party check: is this event ready for guests?                              */
/* ------------------------------------------------------------------------ */

export type CheckItem = { id: string; label: string; ok: boolean; warn?: boolean; detail: string; fix?: string };

export async function getPartyCheck(hostId: string, eventId: string, joinUrl: string): Promise<CheckItem[]> {
  await requireEventRole(hostId, eventId, "dj");
  const event = await getEventById(eventId);
  if (!event) throw notFound("Event not found.");
  const s = normalizeSettings(event.settings);
  const [[counts], [db]] = await Promise.all([
    sql<{ guests: number; songs: number; test_guests: number }[]>`
      select (select count(*)::int from guests where event_id = ${eventId}) as guests,
             (select count(*)::int from queue_items where event_id = ${eventId} and status not in ('removed','declined')) as songs,
             (select count(*)::int from join_funnel where event_id = ${eventId} and step = 'joined') as test_guests`,
    sql<{ ok: number }[]>`select 1 as ok`,
  ]);
  const appUrlOk = Boolean(env.appUrl) || !env.isProd;
  const items: CheckItem[] = [
    {
      id: "live",
      label: "Event is live",
      ok: event.status === "live",
      detail: event.status === "live" ? "Guests can join." : "This event has ended. Reopen it from the control room.",
    },
    {
      id: "requests",
      label: "Song requests are open",
      ok: event.submissions_open && event.status === "live",
      detail: event.submissions_open ? `Guests pick ${s.minPicks} to ${s.maxPicks} songs.` : "Requests are paused. Tap Resume requests.",
    },
    {
      id: "qr",
      label: "QR code points to the live site",
      ok: appUrlOk,
      warn: !env.isProd,
      detail: joinUrl,
      fix: appUrlOk ? undefined : "Set NEXT_PUBLIC_APP_URL in Vercel so QR codes always use your real web address.",
    },
    {
      id: "database",
      label: "Database is connected",
      ok: db?.ok === 1,
      detail: "Saving guests, songs and hearts works.",
    },
    {
      id: "realtime",
      label: "Instant live updates",
      ok: realtimeConfigured(),
      warn: !realtimeConfigured(),
      detail: realtimeConfigured()
        ? "Phones update the moment something changes (and fall back to checking every few seconds)."
        : "Not set up. Phones still update every 4 seconds, which works but feels slower.",
      fix: realtimeConfigured() ? undefined : "Add the Supabase URL, anon key and service key in Vercel (docs/SETUP.md).",
    },
    {
      id: "playlist",
      label: "Playlist connected",
      ok: Boolean(event.live_apple_playlist_id),
      warn: !event.live_apple_playlist_id,
      detail: event.live_apple_playlist_id
        ? "The live Apple Music playlist is linked for Offtrack."
        : appleMusicConfigured()
          ? "No live playlist yet. Open Apple Music & Offtrack and create one (optional)."
          : "Apple Music isn't set up yet, so the DJ plays from the WeParty queue by hand (that's fine).",
    },
    {
      id: "test_guest",
      label: "A test guest has joined",
      ok: counts.test_guests > 0 || counts.guests > 0,
      detail:
        counts.guests > 0
          ? `${counts.guests} guest${counts.guests === 1 ? " has" : "s have"} joined and ${counts.songs} song${counts.songs === 1 ? "" : "s"} are in.`
          : "Scan the QR code with your own phone and join with one song.",
    },
  ];
  if (s.djMode) {
    items.push({
      id: "dj",
      label: "DJ Spotlight set",
      ok: Boolean(s.djName),
      warn: !s.djName,
      detail: s.djName ? `Guests see "DJ ${s.djName} is spinning".` : "Add the DJ's name in DJ settings so guests see who's on.",
    });
    if (effectiveApproval(s)) {
      items.push({ id: "approval", label: "Approval mode is on", ok: true, detail: "Requests wait in Pending until the DJ approves them." });
    }
  }
  return items;
}
