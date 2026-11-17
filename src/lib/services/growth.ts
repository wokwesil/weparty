import "server-only";
import { sql } from "../db";
import { badRequest, forbidden } from "../errors";
import { normalizeSettings } from "../ranking";
import { normalizeInstagram, randomToken, sha256 } from "../security";
import type { PersonRef } from "../types";
import type { EventRow } from "./events";
import { avatarUrl, type GuestRow } from "./guests";
import { requireOrgRole } from "./hosts";

/* ------------------------------------------------------------------------ */
/* "Your night in music": one guest's personal recap                         */
/* ------------------------------------------------------------------------ */

export type RecapSong = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  votes: number;
  played: boolean;
  playOrder: number | null;
};

export type TasteMatch = PersonRef & { shared: number; example: string | null };

export type GuestRecap = {
  displayName: string;
  instagram: string;
  songs: RecapSong[];
  songsPlayed: number;
  heartsGiven: number;
  heartsReceived: number;
  topSong: RecapSong | null;
  topArtist: string | null;
  topGenre: string | null;
  /** 1 = the guest whose songs got the most hearts. Null when nobody got hearts. */
  rank: number | null;
  guests: number;
  matches: TasteMatch[];
};

export async function getGuestRecap(event: EventRow, guest: GuestRow): Promise<GuestRecap> {
  const [songs, given, artists, genres, ranks, matches] = await Promise.all([
    sql<{ id: string; title: string; artist: string; artwork_url: string | null; votes: number; status: string; play_order: number | null }[]>`
      select q.id, q.title, q.artist, q.artwork_url, q.status, q.play_order,
             (select count(*)::int from votes v where v.queue_item_id = q.id) as votes
      from song_requests r join queue_items q on q.id = r.queue_item_id
      where r.guest_id = ${guest.id} and q.status not in ('removed','declined')
      order by q.play_order nulls last, q.created_at`,
    sql<{ n: number }[]>`select count(*)::int as n from votes where guest_id = ${guest.id}`,
    // Artist and genre the guest leaned toward: their picks count double, their hearts once.
    sql<{ artist: string; n: number }[]>`
      select q.artist, sum(w)::int as n from (
        select queue_item_id, 2 as w from song_requests where guest_id = ${guest.id}
        union all select queue_item_id, 1 from votes where guest_id = ${guest.id}
      ) x join queue_items q on q.id = x.queue_item_id
      group by q.artist order by n desc, q.artist limit 1`,
    sql<{ genre: string; n: number }[]>`
      select q.genre, sum(w)::int as n from (
        select queue_item_id, 2 as w from song_requests where guest_id = ${guest.id}
        union all select queue_item_id, 1 from votes where guest_id = ${guest.id}
      ) x join queue_items q on q.id = x.queue_item_id
      where q.genre is not null and q.genre <> 'Music'
      group by q.genre order by n desc, q.genre limit 1`,
    sql<{ guest_id: string; hearts: number }[]>`
      select q.submitted_by as guest_id, count(v.*)::int as hearts
      from queue_items q join votes v on v.queue_item_id = q.id
      where q.event_id = ${event.id} and q.submitted_by is not null and q.status not in ('removed','declined')
      group by q.submitted_by order by hearts desc`,
    getTasteMatches(event, guest),
  ]);
  const recapSongs: RecapSong[] = songs.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    artworkUrl: s.artwork_url,
    votes: s.votes,
    played: s.status === "played" || s.status === "playing",
    playOrder: s.play_order,
  }));
  const rankIdx = ranks.findIndex((r) => r.guest_id === guest.id);
  const [{ n: guestCount }] = await sql<{ n: number }[]>`select count(*)::int as n from guests where event_id = ${event.id}`;
  return {
    displayName: guest.display_name,
    instagram: guest.instagram_username,
    songs: recapSongs,
    songsPlayed: recapSongs.filter((s) => s.played).length,
    heartsGiven: given[0]?.n ?? 0,
    heartsReceived: recapSongs.reduce((t, s) => t + s.votes, 0),
    topSong: [...recapSongs].sort((a, b) => b.votes - a.votes)[0] ?? null,
    topArtist: artists[0]?.artist ?? null,
    topGenre: genres[0]?.genre ?? null,
    rank: rankIdx >= 0 ? rankIdx + 1 : null,
    guests: guestCount,
    matches,
  };
}

/**
 * "People who share your taste": other guests who picked or hearted the same
 * songs as you. Hidden when the host turned off showing people on the replay.
 */
export async function getTasteMatches(event: EventRow, guest: GuestRow, limit = 3): Promise<TasteMatch[]> {
  if (!normalizeSettings(event.settings).replayShowPeople) return [];
  const rows = await sql<
    { id: string; display_name: string; instagram_username: string; has_avatar: boolean; avatar_version: number; shared: number; example: string | null }[]
  >`
    with mine as (
      select queue_item_id from votes where guest_id = ${guest.id}
      union select queue_item_id from song_requests where guest_id = ${guest.id}
    ), others as (
      select guest_id, queue_item_id from votes where event_id = ${event.id} and guest_id <> ${guest.id}
      union select guest_id, queue_item_id from song_requests where event_id = ${event.id} and guest_id <> ${guest.id}
    )
    select g.id, g.display_name, g.instagram_username, g.has_avatar, g.avatar_version,
           count(*)::int as shared, min(q.title) as example
    from others o
    join mine m on m.queue_item_id = o.queue_item_id
    join queue_items q on q.id = o.queue_item_id and q.status not in ('removed','declined')
    join guests g on g.id = o.guest_id and not g.is_blocked
    group by g.id
    order by shared desc, min(o.queue_item_id::text)
    limit ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    instagram: r.instagram_username,
    avatarUrl: avatarUrl(r),
    shared: r.shared,
    example: r.example,
  }));
}

/* ------------------------------------------------------------------------ */
/* "Follow this DJ/host": email opt-in (no push notifications)               */
/* ------------------------------------------------------------------------ */

export const FOLLOW_CONSENT = "Email me when they host their next We Party. I can unsubscribe any time.";

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[a-z]{2,24}$/i;

export async function followerTarget(event: EventRow) {
  const s = normalizeSettings(event.settings);
  const [o] = await sql<{ name: string }[]>`select name from organizations where id = ${event.org_id}`;
  return { name: (s.djMode && s.djName) || o?.name || "this host" };
}

export async function followOrg(event: EventRow, input: { email: string; instagram?: string | null; consent: boolean }) {
  if (!input.consent) throw badRequest("Tick the box so we know you want the emails.");
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw badRequest("That email doesn't look right.");
  const ig = input.instagram ? normalizeInstagram(input.instagram) : null;
  const token = randomToken(24);
  const rows = await sql<{ id: string; unsubscribed_at: Date | null }[]>`
    insert into follows (org_id, event_id, email, instagram_username, consent_text, unsubscribe_hash)
    values (${event.org_id}, ${event.id}, ${email}, ${ig}, ${FOLLOW_CONSENT}, ${sha256(token)})
    on conflict (org_id, lower(email)) do update set
      unsubscribed_at = null,
      consent_text = excluded.consent_text,
      created_at = case when follows.unsubscribed_at is not null then now() else follows.created_at end,
      instagram_username = coalesce(excluded.instagram_username, follows.instagram_username),
      unsubscribe_hash = excluded.unsubscribe_hash
    returning id, unsubscribed_at`;
  return { ok: true, id: rows[0].id, unsubscribeToken: token };
}

export async function unsubscribe(token: string) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return false;
  const rows = await sql`update follows set unsubscribed_at = coalesce(unsubscribed_at, now())
                         where unsubscribe_hash = ${sha256(token)} returning 1`;
  return rows.length > 0;
}

export async function followerCount(orgId: string) {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from follows where org_id = ${orgId} and unsubscribed_at is null`;
  return r.n;
}

export async function listFollowers(hostId: string, orgId: string) {
  const role = await requireOrgRole(hostId, orgId).catch(() => null);
  if (!role) throw forbidden("You don't run this account.");
  return sql<{ email: string; instagram_username: string | null; created_at: Date; event_name: string | null }[]>`
    select f.email, f.instagram_username, f.created_at, e.name as event_name
    from follows f left join events e on e.id = f.event_id
    where f.org_id = ${orgId} and f.unsubscribed_at is null
    order by f.created_at desc`;
}

/* ------------------------------------------------------------------------ */
/* Host terms                                                                */
/* ------------------------------------------------------------------------ */

/** Bump this when the host terms text changes. */
export const HOST_TERMS_VERSION = "2026-11-17";

export async function recordTermsAccepted(eventId: string) {
  await sql`update events set terms_version = ${HOST_TERMS_VERSION}, terms_accepted_at = now() where id = ${eventId}`;
}
