import "server-only";
import type postgres from "postgres";
import { sql } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { blockMatch, type BlockEntry } from "../blocklist";
import { boostPoints } from "../payments/config";
import { normalizeSettings, rankQueue } from "../ranking";
import { notifyEventChanged } from "../realtime";
import type { PersonRef, QueueSnapshot, Shoutout, Song, SongView } from "../types";
import { effectiveApproval, effectiveLock, getEventById, logEvent, toPublicEvent, type EventRow } from "./events";
import { avatarUrl, type GuestRow } from "./guests";
import { requireEventRole } from "./hosts";

type Tx = postgres.TransactionSql | postgres.Sql;

type ItemRow = {
  id: string;
  event_id: string;
  apple_song_id: string;
  title: string;
  artist: string;
  album: string | null;
  artwork_url: string | null;
  duration_ms: number | null;
  isrc: string | null;
  apple_url: string | null;
  preview_url: string | null;
  explicit: boolean;
  genre: string | null;
  boost_cents: number;
  submitted_by: string | null;
  added_by_host: boolean;
  status: SongView["status"];
  pinned_rank: number | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  play_order: number | null;
  votes: number;
  requests: number;
};

/* ------------------------------------------------------------------------ */
/* Song validation                                                           */
/* ------------------------------------------------------------------------ */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const httpsUrl = (v: unknown) => {
  const s = str(v, 1000);
  return /^https:\/\/[^\s]+$/.test(s) ? s : null;
};

/** Cleans a song object sent from a phone. We only keep safe, expected fields. */
export function cleanSong(raw: unknown): Song {
  const r = (raw ?? {}) as Record<string, unknown>;
  const appleId = str(r.appleId, 64);
  if (!/^[A-Za-z0-9.:_-]{1,64}$/.test(appleId)) throw badRequest("One of those songs is missing its Apple Music ID.");
  const title = str(r.title, 300);
  const artist = str(r.artist, 300);
  if (!title || !artist) throw badRequest("One of those songs is missing a title or artist.");
  const duration = Number(r.durationMs);
  return {
    appleId,
    title,
    artist,
    album: str(r.album, 300) || null,
    artworkUrl: httpsUrl(r.artworkUrl),
    durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    isrc: str(r.isrc, 20) || null,
    appleUrl: httpsUrl(r.appleUrl),
    previewUrl: httpsUrl(r.previewUrl),
    explicit: r.explicit === true,
    genre: str(r.genre, 80) || null,
  };
}

/* ------------------------------------------------------------------------ */
/* Reading the queue                                                         */
/* ------------------------------------------------------------------------ */

async function loadItems(tx: Tx, eventId: string, statuses: string[]) {
  return tx<ItemRow[]>`
    select q.*,
      (select count(*)::int from votes v where v.queue_item_id = q.id) as votes,
      (select count(*)::int from song_requests r where r.queue_item_id = q.id) as requests
    from queue_items q
    where q.event_id = ${eventId} and q.status in ${tx(statuses)}`;
}

async function playedCounts(tx: Tx, eventId: string) {
  const rows = await tx<{ submitted_by: string; n: number }[]>`
    select submitted_by, count(*)::int as n from queue_items
    where event_id = ${eventId} and status in ('playing','played') and submitted_by is not null
    group by submitted_by`;
  return Object.fromEntries(rows.map((r) => [r.submitted_by, r.n]));
}

/** Returns the queued songs in the order they will play (Party Shuffle). */
export async function rankedQueue(tx: Tx, event: EventRow) {
  const [items, played, playing] = await Promise.all([
    loadItems(tx, event.id, ["queued"]),
    playedCounts(tx, event.id),
    tx<{ submitted_by: string | null }[]>`
      select submitted_by from queue_items where event_id = ${event.id} and status = 'playing'`,
  ]);
  return rankQueue(
    items.map((i) => ({
      ...i,
      submittedBy: i.submitted_by,
      createdAt: i.created_at.getTime(),
      pinnedRank: i.pinned_rank,
      boostPoints: boostPoints(i.boost_cents ?? 0),
    })),
    { settings: normalizeSettings(event.settings), playedByGuest: played, nowPlayingBy: playing[0]?.submitted_by ?? null },
  );
}

/*
 * One queue snapshot per event version, shared by every phone that asks.
 * With 150 guests refreshing after each heart, this turns 150 database
 * round-trips into one. The version number changes on every write
 * (see notifyEventChanged), so nobody ever sees a stale queue for long.
 */
const snapshotCache = new Map<string, { at: number; promise: Promise<QueueSnapshot> }>();
const SNAPSHOT_TTL_MS = 15_000;

export function getSnapshot(event: EventRow): Promise<QueueSnapshot> {
  const key = `${event.id}:${event.version ?? 0}`;
  const now = Date.now();
  const hit = snapshotCache.get(key);
  if (hit && now - hit.at < SNAPSHOT_TTL_MS) return hit.promise;
  const promise = buildSnapshot(event);
  snapshotCache.set(key, { at: now, promise });
  promise.catch(() => snapshotCache.delete(key));
  if (snapshotCache.size > 300) {
    for (const [k, v] of snapshotCache) if (now - v.at >= SNAPSHOT_TTL_MS) snapshotCache.delete(k);
    if (snapshotCache.size > 300) snapshotCache.delete(snapshotCache.keys().next().value!);
  }
  return promise;
}

/** Deep copy, so one request can't change the shared cached snapshot. */
export function cloneSnapshot(s: QueueSnapshot): QueueSnapshot {
  return structuredClone(s);
}

async function buildSnapshot(event: EventRow): Promise<QueueSnapshot> {
  const settings = normalizeSettings(event.settings);
  const lockCount = effectiveLock(settings);
  const [ranked, others, guests, requesters, totals, shout] = await Promise.all([
    rankedQueue(sql, event),
    loadItems(sql, event.id, ["playing", "played", "pending"]),
    sql<GuestRow[]>`
      select g.* from guests g where g.event_id = ${event.id}`,
    sql<{ queue_item_id: string; guest_id: string }[]>`
      select queue_item_id, guest_id from song_requests where event_id = ${event.id} order by created_at`,
    sql<{ guests: number; votes: number }[]>`
      select (select count(*)::int from guests where event_id = ${event.id}) as guests,
             (select count(*)::int from votes where event_id = ${event.id}) as votes`,
    sql<{ id: number; message: string; created_at: Date }[]>`
      select id, message, created_at from event_shoutouts
      where event_id = ${event.id} and created_at > now() - interval '15 minutes'
      order by id desc limit 1`,
  ]);
  const people = new Map<string, PersonRef>(
    guests.map((g) => [g.id, { id: g.id, displayName: g.display_name, instagram: g.instagram_username, avatarUrl: avatarUrl(g) }]),
  );
  const reqMap = new Map<string, string[]>();
  for (const r of requesters) {
    const list = reqMap.get(r.queue_item_id) ?? [];
    list.push(r.guest_id);
    reqMap.set(r.queue_item_id, list);
  }
  const view = (i: ItemRow, extra: { position?: number | null; pinned?: boolean; score?: number | null } = {}): SongView => ({
    id: i.id,
    appleSongId: i.apple_song_id,
    title: i.title,
    artist: i.artist,
    album: i.album,
    artworkUrl: i.artwork_url,
    appleUrl: i.apple_url,
    previewUrl: i.preview_url,
    durationMs: i.duration_ms,
    explicit: i.explicit,
    status: i.status,
    genre: i.genre,
    boostCents: i.boost_cents ?? 0,
    locked: Boolean(extra.pinned && extra.position && extra.position <= lockCount),
    votes: i.votes,
    requests: i.requests,
    position: extra.position ?? null,
    pinned: extra.pinned ?? false,
    score: extra.score ?? null,
    requester: i.submitted_by ? people.get(i.submitted_by) ?? null : null,
    alsoRequestedBy: (reqMap.get(i.id) ?? [])
      .filter((g) => g !== i.submitted_by)
      .map((g) => people.get(g))
      .filter((p): p is PersonRef => Boolean(p)),
    addedByHost: i.added_by_host,
    createdAt: i.created_at.toISOString(),
    startedAt: i.started_at ? i.started_at.toISOString() : null,
    playOrder: i.play_order,
  });

  const queue = ranked.map((r) => view(r, { position: r.position, pinned: r.pinned, score: r.score }));
  const playingRow = others.find((o) => o.status === "playing");
  const history = others
    .filter((o) => o.status === "played")
    .sort((a, b) => (b.play_order ?? 0) - (a.play_order ?? 0))
    .map((o) => view(o));
  const nowPlaying = playingRow ? view(playingRow) : null;
  const pending = others
    .filter((o) => o.status === "pending")
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    .map((o) => view(o));
  const popular = [...queue, ...(nowPlaying ? [nowPlaying] : []), ...history]
    .filter((s) => s.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 10);

  return {
    event: toPublicEvent(event),
    nowPlaying,
    queue,
    history,
    popular,
    pending,
    shoutout: shout[0]
      ? ({ id: shout[0].id, message: shout[0].message, createdAt: shout[0].created_at.toISOString() } satisfies Shoutout)
      : null,
    stats: {
      guests: totals[0].guests,
      votes: totals[0].votes,
      songs: queue.length + history.length + (nowPlaying ? 1 : 0),
      played: history.length,
      pending: pending.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getGuestActivity(guestId: string) {
  const [votes, mine] = await Promise.all([
    sql<{ queue_item_id: string }[]>`select queue_item_id from votes where guest_id = ${guestId}`,
    sql<{ queue_item_id: string; status: string; title: string; artist: string; artwork_url: string | null }[]>`
      select r.queue_item_id, q.status, q.title, q.artist, q.artwork_url
      from song_requests r join queue_items q on q.id = r.queue_item_id
      where r.guest_id = ${guestId} order by r.created_at`,
  ]);
  return {
    votedIds: votes.map((v) => v.queue_item_id),
    // Songs that count toward this guest's limit (everything except removed/declined).
    mySongIds: mine.filter((m) => m.status !== "removed" && m.status !== "declined").map((m) => m.queue_item_id),
    myPending: mine
      .filter((m) => m.status === "pending" || m.status === "declined")
      .map((m) => ({
        id: m.queue_item_id,
        title: m.title,
        artist: m.artist,
        artworkUrl: m.artwork_url,
        status: m.status as "pending" | "declined",
      })),
  };
}

/* ------------------------------------------------------------------------ */
/* Guests: submitting songs and hearting                                     */
/* ------------------------------------------------------------------------ */

export type SubmitResult = { added: number; joined: number; alreadyMine: number; total: number; pending: number; firstTime: boolean };

async function loadBlocklist(tx: Tx, eventId: string): Promise<BlockEntry[]> {
  return tx<BlockEntry[]>`select kind, value, label from event_blocklist where event_id = ${eventId}`;
}

export async function submitSongs(event: EventRow, guest: GuestRow, rawSongs: unknown[]): Promise<SubmitResult> {
  if (event.status !== "live") throw forbidden("This party has ended, so new songs can't be added.");
  if (!event.submissions_open) throw forbidden("The host has paused song requests for now. Try again soon!");
  if (!Array.isArray(rawSongs) || rawSongs.length === 0) throw badRequest("Pick at least one song.");
  const settings = normalizeSettings(event.settings);
  const approval = effectiveApproval(settings);
  const unique = new Map<string, Song>();
  for (const raw of rawSongs.slice(0, 50)) {
    const s = cleanSong(raw);
    if (!settings.allowExplicit && s.explicit) throw badRequest(`"${s.title}" is explicit, and this party is clean-only.`, "explicit");
    unique.set(s.appleId, s);
  }
  const songs = [...unique.values()];

  const result = await sql.begin(async (tx) => {
    const blocks = await loadBlocklist(tx, event.id);
    for (const s of songs) {
      const hit = blockMatch(s, blocks);
      if (hit) {
        throw badRequest(
          hit.kind === "artist"
            ? `The DJ isn't taking requests for ${hit.label} tonight. Pick something else!`
            : `The DJ isn't taking "${s.title}" tonight. Pick something else!`,
          "blocked",
        );
      }
    }
    // Lock this guest's row so two quick taps can't go over the limit.
    await tx`select id from guests where id = ${guest.id} for update`;
    const [{ n: current }] = await tx<{ n: number }[]>`
      select count(*)::int as n from song_requests r join queue_items q on q.id = r.queue_item_id
      where r.guest_id = ${guest.id} and q.status not in ('removed','declined')`;
    const isFirst = current === 0;
    if (isFirst && songs.length < settings.minPicks) {
      throw badRequest(
        `Pick at least ${settings.minPicks} song${settings.minPicks === 1 ? "" : "s"} to join the queue.`,
        "too_few",
      );
    }
    if (current + songs.length > settings.maxPicks) {
      const left = Math.max(0, settings.maxPicks - current);
      throw badRequest(
        left === 0
          ? `You've already added your ${settings.maxPicks} songs. Heart other people's picks!`
          : `You can add ${left} more song${left === 1 ? "" : "s"} (max ${settings.maxPicks}).`,
        "too_many",
      );
    }
    let added = 0;
    let joined = 0;
    let alreadyMine = 0;
    let pending = 0;
    const status = approval ? "pending" : "queued";
    for (const s of songs) {
      const [ins] = await tx<{ id: string }[]>`
        insert into queue_items (event_id, apple_song_id, title, artist, album, artwork_url, duration_ms, isrc,
                                 apple_url, preview_url, explicit, genre, submitted_by, status)
        values (${event.id}, ${s.appleId}, ${s.title}, ${s.artist}, ${s.album}, ${s.artworkUrl}, ${s.durationMs},
                ${s.isrc}, ${s.appleUrl}, ${s.previewUrl}, ${s.explicit}, ${s.genre ?? null}, ${guest.id}, ${status})
        on conflict (event_id, apple_song_id) do nothing
        returning id`;
      let itemId = ins?.id;
      if (itemId) {
        added++;
        if (approval) pending++;
      } else {
        // Someone already picked it: count this guest as another requester.
        const [existing] = await tx<{ id: string; status: string }[]>`
          select id, status from queue_items where event_id = ${event.id} and apple_song_id = ${s.appleId}`;
        itemId = existing.id;
        if (existing.status === "removed") {
          throw badRequest(`"${s.title}" was removed by the host. Pick something else!`, "removed");
        }
        if (existing.status === "declined") {
          throw badRequest(`The DJ passed on "${s.title}" tonight. Pick something else!`, "declined");
        }
        if (existing.status === "pending") pending++;
      }
      const req = await tx`
        insert into song_requests (queue_item_id, guest_id, event_id) values (${itemId}, ${guest.id}, ${event.id})
        on conflict do nothing returning 1`;
      if (!ins?.id) {
        if (req.length) joined++;
        else alreadyMine++;
      }
    }
    if (!approval) await refillLock(tx, event);
    return { added, joined, alreadyMine, total: current + added + joined, pending, firstTime: isFirst };
  });
  await logEvent(event.id, `guest:${guest.id}`, "songs_submitted", { count: songs.length, ...result });
  await notifyEventChanged(event.id);
  return result;
}

/** Guests can take back a song they picked while it is still waiting in the queue. */
export async function withdrawSong(event: EventRow, guest: GuestRow, itemId: string) {
  await sql.begin(async (tx) => {
    const [item] = await tx<{ id: string; status: string; submitted_by: string | null }[]>`
      select id, status, submitted_by from queue_items where id = ${itemId} and event_id = ${event.id} for update`;
    if (!item) throw notFound("Song not found.");
    if (item.status !== "queued" && item.status !== "pending") throw badRequest("That song has already played or is playing.");
    const del = await tx`delete from song_requests where queue_item_id = ${itemId} and guest_id = ${guest.id} returning 1`;
    if (!del.length) throw forbidden("You didn't pick that song.");
    const [next] = await tx<{ guest_id: string }[]>`
      select guest_id from song_requests where queue_item_id = ${itemId} order by created_at limit 1`;
    if (!next) {
      await tx`update queue_items set status = 'removed' where id = ${itemId}`;
    } else if (item.submitted_by === guest.id) {
      await tx`update queue_items set submitted_by = ${next.guest_id} where id = ${itemId}`;
    }
    await refillLock(tx, (await tx<EventRow[]>`select * from events where id = ${event.id}`)[0]);
  });
  await notifyEventChanged(event.id);
}

export async function setVote(event: EventRow, guest: GuestRow, itemId: string, on: boolean) {
  if (event.status !== "live") throw forbidden("This party has ended.");
  const [item] = await sql<{ id: string; status: string }[]>`
    select id, status from queue_items where id = ${itemId} and event_id = ${event.id}`;
  if (!item || item.status === "removed" || item.status === "skipped" || item.status === "declined") {
    throw notFound("That song isn't in the queue anymore.");
  }
  if (item.status === "pending") throw badRequest("That song is waiting for the DJ to approve it.", "pending");
  if (on) {
    const mine = await sql`select 1 from song_requests where queue_item_id = ${itemId} and guest_id = ${guest.id}`;
    if (mine.length) throw badRequest("You picked this one! Heart other people's songs.", "own_song");
    await sql`insert into votes (queue_item_id, guest_id, event_id) values (${itemId}, ${guest.id}, ${event.id})
              on conflict do nothing`;
  } else {
    await sql`delete from votes where queue_item_id = ${itemId} and guest_id = ${guest.id}`;
  }
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from votes where queue_item_id = ${itemId}`;
  await notifyEventChanged(event.id, "votes");
  return { votes: n, voted: on };
}

/* ------------------------------------------------------------------------ */
/* Host controls                                                             */
/* ------------------------------------------------------------------------ */

async function lockEvent(tx: Tx, eventId: string) {
  const [e] = await tx<EventRow[]>`select * from events where id = ${eventId} for update`;
  if (!e) throw notFound("Event not found.");
  return e;
}

async function startItem(tx: Tx, eventId: string, itemId: string) {
  await tx`update queue_items set status = 'played', finished_at = now()
           where event_id = ${eventId} and status = 'playing'`;
  const [{ play_counter }] = await tx<{ play_counter: number }[]>`
    update events set play_counter = play_counter + 1 where id = ${eventId} returning play_counter`;
  await tx`update queue_items set status = 'playing', started_at = now(), finished_at = null,
             play_order = ${play_counter}, pinned_rank = null
           where id = ${itemId}`;
}

export type HostAction =
  | { type: "next" }
  | { type: "play_now"; itemId: string }
  | { type: "finish_current" }
  | { type: "skip"; itemId: string }
  | { type: "remove"; itemId: string }
  | { type: "restore"; itemId: string }
  | { type: "move"; itemId: string; toIndex: number }
  | { type: "unpin"; itemId: string }
  | { type: "unpin_all" }
  | { type: "approve"; itemId: string }
  | { type: "decline"; itemId: string }
  | { type: "approve_all" };

/**
 * Song locks: when the DJ locks the next N songs, they are frozen in their
 * current order (votes can't move them). As locked songs play, the next
 * crowd-ranked song slides into the lock so there are always N locked.
 */
export async function refillLock(tx: Tx, event: EventRow) {
  const n = effectiveLock(normalizeSettings(event.settings));
  if (n <= 0) return;
  const ranked = await rankedQueue(tx, event);
  const pinnedCount = ranked.filter((r) => r.pinned).length;
  if (pinnedCount >= n || pinnedCount >= ranked.length) return;
  const top = ranked.slice(0, n);
  for (let k = 0; k < top.length; k++) {
    await tx`update queue_items set pinned_rank = ${k + 1} where id = ${top[k].id}`;
  }
}

export async function hostQueueAction(hostId: string, eventId: string, action: HostAction) {
  await requireEventRole(hostId, eventId, "dj");
  const out = await sql.begin(async (tx) => {
    const event = await lockEvent(tx, eventId);
    const needItem = async (id: string) => {
      const [i] = await tx<{ id: string; status: string; title: string }[]>`
        select id, status, title from queue_items where id = ${id} and event_id = ${eventId}`;
      if (!i) throw notFound("Song not found.");
      return i;
    };
    switch (action.type) {
      case "next": {
        const ranked = await rankedQueue(tx, event);
        if (!ranked.length) {
          await tx`update queue_items set status = 'played', finished_at = now()
                   where event_id = ${eventId} and status = 'playing'`;
          return { started: null };
        }
        await startItem(tx, eventId, ranked[0].id);
        return { started: ranked[0].id, title: ranked[0].title };
      }
      case "play_now": {
        const i = await needItem(action.itemId);
        if (i.status !== "queued") throw badRequest("Only songs waiting in the queue can be played now.");
        await startItem(tx, eventId, i.id);
        return { started: i.id, title: i.title };
      }
      case "finish_current": {
        await tx`update queue_items set status = 'played', finished_at = now()
                 where event_id = ${eventId} and status = 'playing'`;
        return {};
      }
      case "skip": {
        const i = await needItem(action.itemId);
        if (i.status !== "queued" && i.status !== "playing") throw badRequest("That song can't be skipped.");
        await tx`update queue_items set status = 'skipped', finished_at = now(), pinned_rank = null where id = ${i.id}`;
        return { title: i.title };
      }
      case "remove": {
        const i = await needItem(action.itemId);
        await tx`update queue_items set status = 'removed', pinned_rank = null where id = ${i.id}`;
        return { title: i.title };
      }
      case "approve": {
        const i = await needItem(action.itemId);
        if (i.status !== "pending") throw badRequest("That song isn't waiting for approval.");
        await tx`update queue_items set status = 'queued', decided_at = now() where id = ${i.id}`;
        return { title: i.title };
      }
      case "approve_all": {
        const rows = await tx`update queue_items set status = 'queued', decided_at = now()
                              where event_id = ${eventId} and status = 'pending' returning 1`;
        return { approved: rows.length };
      }
      case "decline": {
        const i = await needItem(action.itemId);
        if (i.status !== "pending" && i.status !== "queued") throw badRequest("That song can't be declined now.");
        await tx`update queue_items set status = 'declined', decided_at = now(), pinned_rank = null where id = ${i.id}`;
        return { title: i.title };
      }
      case "restore": {
        const i = await needItem(action.itemId);
        if (i.status !== "skipped" && i.status !== "removed" && i.status !== "declined") {
          throw badRequest("That song is already in the queue.");
        }
        await tx`update queue_items set status = 'queued', finished_at = null, play_order = null where id = ${i.id}`;
        return { title: i.title };
      }
      case "move": {
        const ranked = await rankedQueue(tx, event);
        const from = ranked.findIndex((r) => r.id === action.itemId);
        if (from < 0) throw badRequest("Only songs waiting in the queue can be moved.");
        const to = Math.max(0, Math.min(ranked.length - 1, Math.round(action.toIndex)));
        const order = ranked.map((r) => r.id);
        order.splice(from, 1);
        order.splice(to, 0, action.itemId);
        // Freeze everything from the top down to the moved song (and any earlier pins),
        // so the host's order holds. Songs below stay crowd-ranked.
        const lastPinned = Math.max(to, ...ranked.map((r, idx) => (r.pinned ? idx : -1)));
        const pinIds = order.slice(0, lastPinned + 1);
        await tx`update queue_items set pinned_rank = null where event_id = ${eventId} and status = 'queued'`;
        for (let k = 0; k < pinIds.length; k++) {
          await tx`update queue_items set pinned_rank = ${k + 1} where id = ${pinIds[k]}`;
        }
        return { pinned: pinIds.length };
      }
      case "unpin": {
        await tx`update queue_items set pinned_rank = null where id = ${action.itemId} and event_id = ${eventId}`;
        return {};
      }
      case "unpin_all": {
        await tx`update queue_items set pinned_rank = null where event_id = ${eventId}`;
        return {};
      }
      default:
        throw badRequest("Unknown action.");
    }
  }).then(async (res) => {
    // Keep the DJ's lock topped up after anything that changes the queue.
    await sql.begin(async (tx) => refillLock(tx, await lockEvent(tx, eventId)));
    return res;
  });
  await logEvent(eventId, `host:${hostId}`, `queue_${action.type}`, { ...action, ...out });
  await notifyEventChanged(eventId);
  return out;
}

/** Host adds a song directly (no per-guest limits). */
export async function hostAddSong(hostId: string, eventId: string, raw: unknown) {
  await requireEventRole(hostId, eventId, "dj");
  const s = cleanSong(raw);
  const rows = await sql<{ id: string }[]>`
    insert into queue_items (event_id, apple_song_id, title, artist, album, artwork_url, duration_ms, isrc,
                             apple_url, preview_url, explicit, genre, added_by_host)
    values (${eventId}, ${s.appleId}, ${s.title}, ${s.artist}, ${s.album}, ${s.artworkUrl}, ${s.durationMs},
            ${s.isrc}, ${s.appleUrl}, ${s.previewUrl}, ${s.explicit}, ${s.genre ?? null}, true)
    on conflict (event_id, apple_song_id) do update set status = case
      when queue_items.status in ('removed','skipped','declined','pending') then 'queued' else queue_items.status end
    returning id`;
  await logEvent(eventId, `host:${hostId}`, "host_added_song", { title: s.title });
  await notifyEventChanged(eventId);
  return rows[0].id;
}

/* ------------------------------------------------------------------------ */
/* Replay + analytics                                                        */
/* ------------------------------------------------------------------------ */

export type ReplayData = {
  event: ReturnType<typeof toPublicEvent> & { endedAt: string | null };
  played: SongView[];
  mostLiked: SongView[];
  mostRequested: SongView[];
  topContributors: (PersonRef & { songsPlayed: number; heartsReceived: number })[];
  stats: { guests: number; songsSubmitted: number; votes: number; played: number; durationMs: number };
};

export async function getReplay(eventId: string): Promise<ReplayData | null> {
  const event = await getEventById(eventId);
  if (!event) return null;
  const snap = await getSnapshot(event);
  const allPlayed = [...snap.history, ...(snap.nowPlaying ? [snap.nowPlaying] : [])].sort(
    (a, b) => (a.playOrder ?? 0) - (b.playOrder ?? 0),
  );
  const pool = [...allPlayed, ...snap.queue];
  const contributors = new Map<string, PersonRef & { songsPlayed: number; heartsReceived: number }>();
  for (const s of pool) {
    if (!s.requester) continue;
    const c = contributors.get(s.requester.id) ?? { ...s.requester, songsPlayed: 0, heartsReceived: 0 };
    if (s.status === "played" || s.status === "playing") c.songsPlayed++;
    c.heartsReceived += s.votes;
    contributors.set(s.requester.id, c);
  }
  return {
    event: { ...snap.event, endedAt: event.ended_at ? event.ended_at.toISOString() : null },
    played: allPlayed,
    mostLiked: [...pool].filter((s) => s.votes > 0).sort((a, b) => b.votes - a.votes).slice(0, 5),
    mostRequested: [...pool].filter((s) => s.requests > 1).sort((a, b) => b.requests - a.requests).slice(0, 5),
    topContributors: [...contributors.values()]
      .sort((a, b) => b.heartsReceived - a.heartsReceived || b.songsPlayed - a.songsPlayed)
      .slice(0, 8),
    stats: {
      guests: snap.stats.guests,
      songsSubmitted: snap.stats.songs,
      votes: snap.stats.votes,
      played: allPlayed.length,
      durationMs: allPlayed.reduce((t, s) => t + (s.durationMs ?? 0), 0),
    },
  };
}

export async function getEventLog(hostId: string, eventId: string, limit = 50) {
  await requireEventRole(hostId, eventId, "dj");
  return sql<{ id: number; actor: string; action: string; details: unknown; created_at: Date }[]>`
    select id, actor, action, details, created_at from event_log where event_id = ${eventId}
    order by id desc limit ${limit}`;
}

export async function getTimeline(eventId: string) {
  return sql<{ bucket: Date; votes: number }[]>`
    select date_trunc('minute', created_at) - (extract(minute from created_at)::int % 15) * interval '1 minute' as bucket,
           count(*)::int as votes
    from votes where event_id = ${eventId} group by 1 order by 1`;
}

export async function getGuestPickedAppleIds(guestId: string) {
  const rows = await sql<{ apple_song_id: string }[]>`
    select q.apple_song_id from song_requests r join queue_items q on q.id = r.queue_item_id
    where r.guest_id = ${guestId} and q.status not in ('removed','declined')`;
  return rows.map((r) => r.apple_song_id);
}
