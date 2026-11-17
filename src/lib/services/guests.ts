import "server-only";
import { sql } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { notifyEventChanged } from "../realtime";
import { normalizeInstagram, randomToken, sha256 } from "../security";
import type { PersonRef } from "../types";
import { logEvent, type EventRow } from "./events";
import { requireEventRole } from "./hosts";

export type GuestRow = {
  id: string;
  event_id: string;
  display_name: string;
  instagram_username: string;
  has_avatar: boolean;
  avatar_version: number;
  is_blocked: boolean;
  created_at: Date;
};

export function avatarUrl(g: { id: string; has_avatar: boolean; avatar_version: number }) {
  return g.has_avatar ? `/api/avatars/${g.id}?v=${g.avatar_version}` : null;
}

export function toPerson(g: GuestRow): PersonRef {
  return { id: g.id, displayName: g.display_name, instagram: g.instagram_username, avatarUrl: avatarUrl(g) };
}

export async function registerGuest(event: EventRow, input: { displayName: string; instagram: string }) {
  if (event.status === "ended") throw badRequest("This party has ended. Check out the replay!");
  const ig = normalizeInstagram(input.instagram);
  if (!ig) throw badRequest("That Instagram username doesn't look right. Use letters, numbers, dots and underscores.");
  const displayName = input.displayName.trim().replace(/\s+/g, " ").slice(0, 60) || ig;
  const token = randomToken();
  const rows = await sql<GuestRow[]>`
    insert into guests (event_id, token_hash, display_name, instagram_username)
    values (${event.id}, ${sha256(token)}, ${displayName}, ${ig})
    on conflict (event_id, instagram_username) do nothing
    returning *`;
  if (!rows.length) {
    throw badRequest(
      `@${ig} is already at this party. If that's you on a new phone, ask the host to reset your profile.`,
      "instagram_taken",
    );
  }
  await logEvent(event.id, `guest:${rows[0].id}`, "guest_joined", { instagram: ig });
  await notifyEventChanged(event.id, "people");
  return { guest: rows[0], token };
}

export async function getGuestByToken(eventId: string, token: string | undefined | null) {
  if (!token) return null;
  const [g] = await sql<GuestRow[]>`
    select * from guests where token_hash = ${sha256(token)} and event_id = ${eventId}`;
  if (!g || g.is_blocked) return null;
  return g;
}

export async function updateGuestProfile(guest: GuestRow, input: { displayName?: string; instagram?: string }) {
  const displayName = input.displayName?.trim().replace(/\s+/g, " ").slice(0, 60) || guest.display_name;
  let ig = guest.instagram_username;
  if (input.instagram !== undefined) {
    const n = normalizeInstagram(input.instagram);
    if (!n) throw badRequest("That Instagram username doesn't look right.");
    ig = n;
  }
  try {
    const [g] = await sql<GuestRow[]>`
      update guests set display_name = ${displayName}, instagram_username = ${ig}
      where id = ${guest.id} returning *`;
    await notifyEventChanged(guest.event_id, "people");
    return g;
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") throw badRequest(`@${ig} is already at this party.`);
    throw e;
  }
}

const MAX_AVATAR_BYTES = 400_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function sniffMime(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function setGuestAvatar(guest: GuestRow, data: Buffer) {
  if (data.length === 0) throw badRequest("That photo is empty.");
  if (data.length > MAX_AVATAR_BYTES) throw badRequest("That photo is too large. Try a smaller one.");
  const mime = sniffMime(data);
  if (!mime || !ALLOWED.has(mime)) throw badRequest("Please upload a JPEG, PNG or WebP photo.");
  await sql.begin(async (tx) => {
    await tx`insert into guest_avatars (guest_id, mime, data) values (${guest.id}, ${mime}, ${data})
             on conflict (guest_id) do update set mime = excluded.mime, data = excluded.data, updated_at = now()`;
    await tx`update guests set has_avatar = true, avatar_version = avatar_version + 1 where id = ${guest.id}`;
  });
  await notifyEventChanged(guest.event_id, "people");
}

export async function getAvatar(guestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(guestId)) return null;
  const [a] = await sql<{ mime: string; data: Buffer }[]>`
    select a.mime, a.data from guest_avatars a join guests g on g.id = a.guest_id
    where a.guest_id = ${guestId} and not g.is_blocked`;
  return a ?? null;
}

export type PersonWithSongs = PersonRef & {
  joinedAt: string;
  songs: { id: string; title: string; artist: string; artworkUrl: string | null; status: string }[];
  heartsReceived: number;
};

/** Everyone at the party, for the "People" tab and the host's guest list. */
export async function listPeople(eventId: string): Promise<PersonWithSongs[]> {
  const guests = await sql<GuestRow[]>`
    select * from guests where event_id = ${eventId} and not is_blocked order by created_at`;
  const songs = await sql<{ guest_id: string; id: string; title: string; artist: string; artwork_url: string | null; status: string }[]>`
    select r.guest_id, q.id, q.title, q.artist, q.artwork_url, q.status
    from song_requests r join queue_items q on q.id = r.queue_item_id
    where r.event_id = ${eventId} and q.status <> 'removed'
    order by r.created_at`;
  const hearts = await sql<{ guest_id: string; n: number }[]>`
    select q.submitted_by as guest_id, count(v.*)::int as n
    from queue_items q join votes v on v.queue_item_id = q.id
    where q.event_id = ${eventId} and q.submitted_by is not null
    group by q.submitted_by`;
  const heartMap = new Map(hearts.map((h) => [h.guest_id, h.n]));
  const songMap = new Map<string, PersonWithSongs["songs"]>();
  for (const s of songs) {
    const list = songMap.get(s.guest_id) ?? [];
    list.push({ id: s.id, title: s.title, artist: s.artist, artworkUrl: s.artwork_url, status: s.status });
    songMap.set(s.guest_id, list);
  }
  return guests.map((g) => ({
    ...toPerson(g),
    joinedAt: g.created_at.toISOString(),
    songs: songMap.get(g.id) ?? [],
    heartsReceived: heartMap.get(g.id) ?? 0,
  }));
}

/** Host removes a guest (their songs and hearts are removed too). */
export async function removeGuest(hostId: string, eventId: string, guestId: string) {
  await requireEventRole(hostId, eventId, "dj");
  const [g] = await sql<GuestRow[]>`select * from guests where id = ${guestId} and event_id = ${eventId}`;
  if (!g) throw notFound("Guest not found.");
  await purgeGuest(eventId, guestId);
  await logEvent(eventId, `host:${hostId}`, "guest_removed", { instagram: g.instagram_username });
  await notifyEventChanged(eventId, "people");
}

/**
 * A guest deletes their own info from a party: profile, photo, hearts and song
 * requests. Songs other guests also picked stay in the queue.
 */
export async function deleteGuestSelf(guest: GuestRow) {
  await purgeGuest(guest.event_id, guest.id);
  await logEvent(guest.event_id, "system", "guest_deleted_self", {});
  await notifyEventChanged(guest.event_id, "people");
}

async function purgeGuest(eventId: string, guestId: string) {
  await sql.begin(async (tx) => {
    await tx`update queue_items set status = 'removed'
             where event_id = ${eventId} and submitted_by = ${guestId} and status = 'queued'
               and not exists (select 1 from song_requests r where r.queue_item_id = queue_items.id and r.guest_id <> ${guestId})`;
    // Songs other guests also picked stay, credited to the next requester.
    await tx`update queue_items q set submitted_by = (
               select r.guest_id from song_requests r
               where r.queue_item_id = q.id and r.guest_id <> ${guestId} order by r.created_at limit 1)
             where q.event_id = ${eventId} and q.submitted_by = ${guestId}
               and exists (select 1 from song_requests r where r.queue_item_id = q.id and r.guest_id <> ${guestId})`;
    await tx`delete from guests where id = ${guestId}`;
  });
}

export function assertGuestCanAct(event: EventRow) {
  if (event.status === "ended") throw forbidden("This party has ended.");
}
