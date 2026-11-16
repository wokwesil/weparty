import "server-only";
import { sql } from "../db";
import { badRequest, notFound } from "../errors";
import { normalizeSettings, type PartySettings } from "../ranking";
import { notifyEventChanged } from "../realtime";
import { randomEventCode } from "../security";
import type { EventPublic } from "../types";
import { requireEventRole, requireOrgRole } from "./hosts";

export type EventRow = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  venue_name: string | null;
  description: string | null;
  starts_at: Date | null;
  status: "draft" | "live" | "ended";
  submissions_open: boolean;
  settings: unknown;
  replay_apple_playlist_url: string | null;
  live_apple_playlist_id: string | null;
  play_counter: number;
  created_at: Date;
  ended_at: Date | null;
};

export function toPublicEvent(e: EventRow): EventPublic {
  const s = normalizeSettings(e.settings);
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    venueName: e.venue_name,
    description: e.description,
    startsAt: e.starts_at ? e.starts_at.toISOString() : null,
    status: e.status,
    submissionsOpen: e.submissions_open && e.status === "live",
    minPicks: s.minPicks,
    maxPicks: s.maxPicks,
    replayAppleUrl: e.replay_apple_playlist_url,
  };
}

export async function getEventByCode(code: string) {
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return null;
  const [e] = await sql<EventRow[]>`select * from events where code = ${clean}`;
  return e ?? null;
}

export async function getEventById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [e] = await sql<EventRow[]>`select * from events where id = ${id}`;
  return e ?? null;
}

export async function requireEventByCode(code: string) {
  const e = await getEventByCode(code);
  if (!e) throw notFound("We couldn't find that party. Check the QR code or link.");
  return e;
}

export type EventInput = {
  name: string;
  venueName?: string | null;
  description?: string | null;
  startsAt?: string | null;
};

function cleanInput(input: EventInput) {
  const name = input.name?.trim();
  if (!name) throw badRequest("Give your event a name.");
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) throw badRequest("That date doesn't look right.");
  return {
    name: name.slice(0, 120),
    venue: input.venueName?.trim().slice(0, 120) || null,
    description: input.description?.trim().slice(0, 1000) || null,
    startsAt,
  };
}

export async function createEvent(hostId: string, orgId: string, input: EventInput) {
  await requireOrgRole(hostId, orgId);
  const v = cleanInput(input);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomEventCode(6);
    const rows = await sql<{ id: string }[]>`
      insert into events (org_id, code, name, venue_name, description, starts_at, created_by)
      values (${orgId}, ${code}, ${v.name}, ${v.venue}, ${v.description}, ${v.startsAt}, ${hostId})
      on conflict (code) do nothing
      returning id`;
    if (rows.length) {
      await logEvent(rows[0].id, `host:${hostId}`, "event_created", { name: v.name });
      return rows[0].id;
    }
  }
  throw new Error("Could not generate a unique event code");
}

export async function updateEvent(hostId: string, eventId: string, input: EventInput & { replayAppleUrl?: string | null }) {
  await requireEventRole(hostId, eventId, "admin");
  const v = cleanInput(input);
  let replayUrl: string | null | undefined = undefined;
  if (input.replayAppleUrl !== undefined) {
    replayUrl = input.replayAppleUrl?.trim() || null;
    if (replayUrl && !/^https:\/\/(music|itunes)\.apple\.com\//.test(replayUrl)) {
      throw badRequest("The Apple Music link should start with https://music.apple.com/");
    }
  }
  await sql`
    update events set name = ${v.name}, venue_name = ${v.venue}, description = ${v.description},
      starts_at = ${v.startsAt},
      replay_apple_playlist_url = ${replayUrl === undefined ? sql`replay_apple_playlist_url` : replayUrl}
    where id = ${eventId}`;
  await notifyEventChanged(eventId);
}

/** Remembers which playlist in the host's Apple Music library is used for live Offtrack sync. */
export async function setLivePlaylistId(hostId: string, eventId: string, playlistId: string | null) {
  await requireEventRole(hostId, eventId, "dj");
  if (playlistId && !/^[A-Za-z0-9._-]{1,100}$/.test(playlistId)) throw badRequest("Bad playlist id.");
  await sql`update events set live_apple_playlist_id = ${playlistId} where id = ${eventId}`;
}

export async function updateSettings(hostId: string, eventId: string, patch: Partial<PartySettings>) {
  await requireEventRole(hostId, eventId, "dj");
  const [e] = await sql<{ settings: unknown }[]>`select settings from events where id = ${eventId}`;
  const next = normalizeSettings({ ...normalizeSettings(e.settings), ...patch });
  await sql`update events set settings = ${sql.json(next)} where id = ${eventId}`;
  await logEvent(eventId, `host:${hostId}`, "settings_changed", next);
  await notifyEventChanged(eventId);
  return next;
}

export async function setSubmissionsOpen(hostId: string, eventId: string, open: boolean) {
  await requireEventRole(hostId, eventId, "dj");
  await sql`update events set submissions_open = ${open} where id = ${eventId}`;
  await logEvent(eventId, `host:${hostId}`, open ? "submissions_resumed" : "submissions_paused");
  await notifyEventChanged(eventId);
}

export async function endEvent(hostId: string, eventId: string) {
  await requireEventRole(hostId, eventId, "dj");
  await sql.begin(async (tx) => {
    await tx`update queue_items set status = 'played', finished_at = now()
             where event_id = ${eventId} and status = 'playing'`;
    await tx`update events set status = 'ended', submissions_open = false, ended_at = coalesce(ended_at, now())
             where id = ${eventId}`;
  });
  await logEvent(eventId, `host:${hostId}`, "event_ended");
  await notifyEventChanged(eventId, "ended");
}

export async function reopenEvent(hostId: string, eventId: string) {
  await requireEventRole(hostId, eventId, "admin");
  await sql`update events set status = 'live', submissions_open = true, ended_at = null where id = ${eventId}`;
  await logEvent(eventId, `host:${hostId}`, "event_reopened");
  await notifyEventChanged(eventId);
}

export async function deleteEvent(hostId: string, eventId: string) {
  await requireEventRole(hostId, eventId, "admin");
  await sql`delete from events where id = ${eventId}`;
}

export async function logEvent(eventId: string, actor: string, action: string, details: object = {}) {
  await sql`insert into event_log (event_id, actor, action, details)
            values (${eventId}, ${actor}, ${action}, ${sql.json(details as never)})`;
}

export type HostEventSummary = {
  id: string;
  code: string;
  name: string;
  venueName: string | null;
  startsAt: string | null;
  status: string;
  submissionsOpen: boolean;
  createdAt: string;
  orgId: string;
  orgName: string;
  guests: number;
  songs: number;
  votes: number;
  played: number;
};

export async function listHostEvents(hostId: string): Promise<HostEventSummary[]> {
  const rows = await sql`
    select e.id, e.code, e.name, e.venue_name, e.starts_at, e.status, e.submissions_open, e.created_at,
           e.org_id, o.name as org_name,
           (select count(*)::int from guests g where g.event_id = e.id) as guests,
           (select count(*)::int from queue_items q where q.event_id = e.id and q.status <> 'removed') as songs,
           (select count(*)::int from votes v where v.event_id = e.id) as votes,
           (select count(*)::int from queue_items q where q.event_id = e.id and q.status = 'played') as played
    from events e
    join org_members m on m.org_id = e.org_id and m.host_id = ${hostId}
    join organizations o on o.id = e.org_id
    order by coalesce(e.starts_at, e.created_at) desc`;
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    venueName: r.venue_name,
    startsAt: r.starts_at ? new Date(r.starts_at).toISOString() : null,
    status: r.status,
    submissionsOpen: r.submissions_open,
    createdAt: new Date(r.created_at).toISOString(),
    orgId: r.org_id,
    orgName: r.org_name,
    guests: r.guests,
    songs: r.songs,
    votes: r.votes,
    played: r.played,
  }));
}
