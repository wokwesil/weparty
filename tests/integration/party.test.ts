/**
 * Integration tests against a real Postgres database.
 * Run with: TEST_DATABASE_URL=postgres://... npm test
 * (Uses the TEST songs catalog; no internet needed.)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
process.env.DATABASE_URL = url ?? "";

type Mods = {
  sql: typeof import("../../src/lib/db").sql;
  hosts: typeof import("../../src/lib/services/hosts");
  events: typeof import("../../src/lib/services/events");
  guests: typeof import("../../src/lib/services/guests");
  queue: typeof import("../../src/lib/services/queue");
};
let m: Mods;

const song = (n: number) => ({ appleId: `test-${n}`, title: `[TEST] Song ${n}`, artist: `[TEST] Artist ${n}`, artworkUrl: "https://example.com/a.jpg" });
const songs = (from: number, count: number) => Array.from({ length: count }, (_, i) => song(from + i));

d("party flow (database)", () => {
  let hostId: string;
  let orgId: string;
  let eventId: string;

  beforeAll(async () => {
    m = {
      sql: (await import("../../src/lib/db")).sql,
      hosts: await import("../../src/lib/services/hosts"),
      events: await import("../../src/lib/services/events"),
      guests: await import("../../src/lib/services/guests"),
      queue: await import("../../src/lib/services/queue"),
    };
    const email = `host-${Date.now()}@test.weparty`;
    hostId = await m.hosts.signupHost({ email, password: "correct horse", displayName: "Test Host" });
    orgId = (await m.hosts.getHostAccount(hostId))!.orgs[0].id;
    eventId = await m.events.createEvent(hostId, orgId, { name: "[TEST] Launch Party" });
  });

  afterAll(async () => {
    if (eventId) await m.sql`delete from events where id = ${eventId}`;
    if (hostId) await m.sql`delete from hosts where id = ${hostId}`;
    if (orgId) await m.sql`delete from organizations where id = ${orgId}`;
    await m.sql.end();
  });

  const ev = async () => (await m.events.getEventById(eventId))!;

  it("host can log in with the right password only", async () => {
    const email = (await m.hosts.getHostAccount(hostId))!.email;
    await expect(m.hosts.loginHost(email, "correct horse")).resolves.toBe(hostId);
    await expect(m.hosts.loginHost(email, "wrong")).rejects.toThrow(/incorrect/);
  });

  it("each event gets a unique QR code", async () => {
    const e = await ev();
    expect(e.code).toMatch(/^[a-z0-9]{6}$/);
    expect((await m.events.getEventByCode(e.code.toUpperCase()))!.id).toBe(eventId);
  });

  it("runs a full party with several guests", async () => {
    const e = await ev();
    const g = [];
    for (const [i, ig] of ["@Alice.Party", "bob_dj", "https://instagram.com/cara/", "dee"].entries()) {
      g.push((await m.guests.registerGuest(e, { displayName: `Guest ${i}`, instagram: ig })).guest);
    }
    expect(g.map((x) => x.instagram_username)).toEqual(["alice.party", "bob_dj", "cara", "dee"]);

    // same Instagram can't register twice in one event
    await expect(m.guests.registerGuest(e, { displayName: "x", instagram: "BOB_DJ" })).rejects.toThrow(/already at this party/);

    // the host can require more than one song (default is 1), at most 15 total
    await m.events.updateSettings(hostId, eventId, { minPicks: 5 });
    await expect(m.queue.submitSongs(await ev(), g[0], songs(1, 3))).rejects.toThrow(/at least 5/);
    await m.events.updateSettings(hostId, eventId, { minPicks: 1 });
    await expect(m.queue.submitSongs(e, g[0], songs(1, 16))).rejects.toThrow(/up to|can add|already added/);
    expect(await m.queue.submitSongs(e, g[0], songs(1, 5))).toMatchObject({ added: 5, total: 5 });
    expect(await m.queue.submitSongs(e, g[1], songs(10, 5))).toMatchObject({ added: 5 });
    // cara picks 2 songs alice already picked: no duplicates, counted as requests
    const r = await m.queue.submitSongs(e, g[2], [...songs(1, 2), ...songs(20, 3)]);
    expect(r).toMatchObject({ added: 3, joined: 2 });
    expect(await m.queue.submitSongs(e, g[3], songs(30, 5))).toMatchObject({ added: 5 });
    // adding more later works one at a time, up to 15
    await m.queue.submitSongs(e, g[0], songs(40, 10));
    await expect(m.queue.submitSongs(e, g[0], [song(50)])).rejects.toThrow(/already added your 15/);

    let snap = await m.queue.getSnapshot(await ev());
    expect(snap.queue.length).toBe(5 + 5 + 3 + 5 + 10);
    expect(snap.stats.guests).toBe(4);
    const s1 = snap.queue.find((s) => s.appleSongId === "test-1")!;
    expect(s1.requests).toBe(2);
    expect(s1.requester!.instagram).toBe("alice.party");
    expect(s1.alsoRequestedBy.map((p) => p.instagram)).toEqual(["cara"]);

    // fairness: the first 4 songs come from 4 different people
    const firstFour = snap.queue.slice(0, 4).map((s) => s.requester!.id);
    expect(new Set(firstFour).size).toBe(4);

    // voting
    const target = snap.queue.find((s) => s.appleSongId === "test-34")!; // dee's 5th song
    for (const voter of [g[0], g[1], g[2]]) await m.queue.setVote(e, voter, target.id, true);
    await m.queue.setVote(e, g[1], target.id, true); // duplicate vote ignored
    snap = await m.queue.getSnapshot(await ev());
    const t2 = snap.queue.find((s) => s.id === target.id)!;
    expect(t2.votes).toBe(3);
    expect(t2.position).toBeLessThan(target.position!);
    // can't heart your own song
    await expect(m.queue.setVote(e, g[3], target.id, true)).rejects.toThrow(/You picked this one/);
    // remove a vote
    expect(await m.queue.setVote(e, g[2], target.id, false)).toMatchObject({ votes: 2 });

    // host plays songs
    await m.queue.hostQueueAction(hostId, eventId, { type: "next" });
    snap = await m.queue.getSnapshot(await ev());
    const first = snap.nowPlaying!;
    expect(first).toBeTruthy();
    // votes on the playing song don't move it
    await m.queue.setVote(e, g.find((x) => x.id !== first.requester?.id)!, first.id, true);
    expect((await m.queue.getSnapshot(await ev())).nowPlaying!.id).toBe(first.id);

    await m.queue.hostQueueAction(hostId, eventId, { type: "next" });
    const second = (await m.queue.getSnapshot(await ev())).nowPlaying!;
    // skip the third one while it plays -> not in replay
    await m.queue.hostQueueAction(hostId, eventId, { type: "next" });
    const third = (await m.queue.getSnapshot(await ev())).nowPlaying!;
    await m.queue.hostQueueAction(hostId, eventId, { type: "skip", itemId: third.id });

    // host override: move the last song to the top, then play it
    snap = await m.queue.getSnapshot(await ev());
    const last = snap.queue[snap.queue.length - 1];
    await m.queue.hostQueueAction(hostId, eventId, { type: "move", itemId: last.id, toIndex: 0 });
    snap = await m.queue.getSnapshot(await ev());
    expect(snap.queue[0].id).toBe(last.id);
    expect(snap.queue[0].pinned).toBe(true);
    // the crowd can't push past a pinned song
    const second2 = snap.queue[1];
    for (const voter of g) if (voter.id !== second2.requester?.id) await m.queue.setVote(e, voter, second2.id, true).catch(() => {});
    expect((await m.queue.getSnapshot(await ev())).queue[0].id).toBe(last.id);

    await m.queue.hostQueueAction(hostId, eventId, { type: "play_now", itemId: last.id });
    // remove a song
    const toRemove = (await m.queue.getSnapshot(await ev())).queue[2];
    await m.queue.hostQueueAction(hostId, eventId, { type: "remove", itemId: toRemove.id });
    expect((await m.queue.getSnapshot(await ev())).queue.find((s) => s.id === toRemove.id)).toBeUndefined();

    // pause submissions blocks guests
    await m.events.setSubmissionsOpen(hostId, eventId, false);
    const newbie = (await m.guests.registerGuest(await ev(), { displayName: "Eve", instagram: "eve" })).guest;
    await expect(m.queue.submitSongs(await ev(), newbie, songs(60, 5))).rejects.toThrow(/paused/);
    await m.events.setSubmissionsOpen(hostId, eventId, true);
    await m.queue.submitSongs(await ev(), newbie, songs(60, 5));

    // end the event: the playing song counts as played
    await m.events.endEvent(hostId, eventId);
    const ended = await ev();
    expect(ended.status).toBe("ended");
    await expect(m.queue.submitSongs(ended, g[1], [song(70)])).rejects.toThrow(/ended/);
    await expect(m.queue.setVote(ended, g[1], second.id, true)).rejects.toThrow(/ended/);

    const replay = (await m.queue.getReplay(eventId))!;
    expect(replay.played.map((s) => s.id)).toEqual([first.id, second.id, last.id]);
    expect(replay.played.map((s) => s.playOrder)).toEqual([1, 2, 4]); // #3 was skipped, so it is left out
    expect(replay.mostRequested[0].appleSongId).toMatch(/test-[12]/);
    expect(replay.mostLiked[0].votes).toBeGreaterThan(0);
    expect(replay.stats.guests).toBe(5);
  });

  it("only hosts of the event's account can control it", async () => {
    const other = await m.hosts.signupHost({ email: `other-${Date.now()}@test.weparty`, password: "password123", displayName: "Other" });
    try {
      await expect(m.queue.hostQueueAction(other, eventId, { type: "next" })).rejects.toThrow(/don't manage/);
      await expect(m.events.endEvent(other, eventId)).rejects.toThrow(/don't manage/);
      // invite as DJ: can run the queue but not delete the event
      await m.hosts.addOrgMember(hostId, orgId, (await m.hosts.getHostAccount(other))!.email, "dj");
      await expect(m.hosts.requireEventRole(other, eventId)).resolves.toBe("dj");
      await expect(m.events.deleteEvent(other, eventId)).rejects.toThrow(/owner or an admin/);
    } finally {
      const acc = await m.hosts.getHostAccount(other);
      await m.sql`delete from organizations where id in ${m.sql(acc!.orgs.filter((o) => o.role === "owner").map((o) => o.id))}`;
      await m.sql`delete from hosts where id = ${other}`;
    }
  });

  it("guest tokens are stored hashed and identify the right guest", async () => {
    const e2 = await m.events.createEvent(hostId, orgId, { name: "[TEST] Token party" });
    const e = (await m.events.getEventById(e2))!;
    const { guest, token } = await m.guests.registerGuest(e, { displayName: "T", instagram: "token.test" });
    const [row] = await m.sql`select token_hash from guests where id = ${guest.id}`;
    expect(row.token_hash).not.toContain(token);
    expect((await m.guests.getGuestByToken(e.id, token))!.id).toBe(guest.id);
    expect(await m.guests.getGuestByToken(eventId, token)).toBeNull(); // different event
    expect(await m.guests.getGuestByToken(e.id, "nope")).toBeNull();
    await m.sql`delete from events where id = ${e2}`;
  });
});
