/**
 * Growth features (recap, taste matches, follow + unsubscribe, host terms) against a real Postgres database.
 * Run with: TEST_DATABASE_URL=postgres://... npm test
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
  growth: typeof import("../../src/lib/services/growth");
};
let m: Mods;

const song = (n: number, artist = `[TEST] Artist ${n % 3}`) => ({ appleId: `gr-${n}`, title: `[TEST] Song ${n}`, artist, genre: n % 2 ? "Pop" : "Dance" });

d("Growth: recap, taste, follow, terms (database)", () => {
  let hostId: string;
  let orgId: string;
  let eventId: string;
  const ev = async () => (await m.events.getEventById(eventId))!;
  const join = async (ig: string) => (await m.guests.registerGuest(await ev(), { displayName: ig, instagram: ig })).guest;
  const itemId = async (n: number) => (await m.sql<{ id: string }[]>`select id from queue_items where event_id = ${eventId} and apple_song_id = ${`gr-${n}`}`)[0].id;

  beforeAll(async () => {
    m = {
      sql: (await import("../../src/lib/db")).sql,
      hosts: await import("../../src/lib/services/hosts"),
      events: await import("../../src/lib/services/events"),
      guests: await import("../../src/lib/services/guests"),
      queue: await import("../../src/lib/services/queue"),
      growth: await import("../../src/lib/services/growth"),
    };
    hostId = await m.hosts.signupHost({ email: `gr-${Date.now()}@test.weparty`, password: "correct horse", displayName: "Growth Test" });
    orgId = (await m.hosts.getHostAccount(hostId))!.orgs[0].id;
    eventId = await m.events.createEvent(hostId, orgId, { name: "[TEST] Growth Night" });
  });

  afterAll(async () => {
    if (orgId) await m.sql`delete from follows where org_id = ${orgId}`;
    if (eventId) await m.sql`delete from events where id = ${eventId}`;
    if (hostId) await m.sql`delete from hosts where id = ${hostId}`;
    if (orgId) await m.sql`delete from organizations where id = ${orgId}`;
    await m.sql.end();
  });

  it("builds a personal recap and finds people with the same taste", async () => {
    const ana = await join("ana.recap");
    const ben = await join("ben.recap");
    const cat = await join("cat.recap");
    await m.queue.submitSongs(await ev(), ana, [song(1, "[TEST] Robyn"), song(2, "[TEST] Robyn")]);
    await m.queue.submitSongs(await ev(), ben, [song(3)]);
    await m.queue.submitSongs(await ev(), cat, [song(4)]);
    // Ben hearts both of Ana's songs; Cat hearts one of them.
    await m.queue.setVote(await ev(), ben, await itemId(1), true);
    await m.queue.setVote(await ev(), ben, await itemId(2), true);
    await m.queue.setVote(await ev(), cat, await itemId(1), true);
    await m.queue.setVote(await ev(), ana, await itemId(3), true);

    const r = await m.growth.getGuestRecap(await ev(), ana);
    expect(r.songs).toHaveLength(2);
    expect(r.heartsReceived).toBe(3);
    expect(r.heartsGiven).toBe(1);
    expect(r.topArtist).toBe("[TEST] Robyn");
    expect(r.topSong?.title).toBe("[TEST] Song 1");
    expect(r.rank).toBe(1);
    expect(r.matches.map((x) => x.instagram)).toEqual(["ben.recap", "cat.recap"]);
    expect(r.matches[0].shared).toBe(3); // 2 hearts on Ana's songs + Ben's own song Ana hearted
  });

  it("hides taste matches when the host hides people on the replay", async () => {
    await m.events.updateSettings(hostId, eventId, { replayShowPeople: false });
    const ana = (await m.sql<{ id: string }[]>`select id from guests where event_id = ${eventId} and instagram_username = 'ana.recap'`)[0];
    const g = (await m.sql`select * from guests where id = ${ana.id}`)[0] as never;
    expect(await m.growth.getTasteMatches(await ev(), g)).toEqual([]);
    await m.events.updateSettings(hostId, eventId, { replayShowPeople: true });
  });

  it("blocked guests never show up as a match", async () => {
    const [ben] = await m.sql<{ id: string }[]>`select id from guests where event_id = ${eventId} and instagram_username = 'ben.recap'`;
    await m.sql`update guests set is_blocked = true where id = ${ben.id}`;
    const g = (await m.sql`select * from guests where event_id = ${eventId} and instagram_username = 'ana.recap'`)[0] as never;
    expect((await m.growth.getTasteMatches(await ev(), g)).map((x) => x.instagram)).toEqual(["cat.recap"]);
    await m.sql`update guests set is_blocked = false where id = ${ben.id}`;
  });

  it("follow needs consent and a real email, and unsubscribe works", async () => {
    await expect(m.growth.followOrg(await ev(), { email: "fan@example.com", consent: false })).rejects.toThrow(/Tick the box/);
    await expect(m.growth.followOrg(await ev(), { email: "not-an-email", consent: true })).rejects.toThrow(/doesn't look right/);
    const f = await m.growth.followOrg(await ev(), { email: "Fan@Example.com", instagram: "@fan.one", consent: true });
    // Following twice doesn't make a duplicate.
    const again = await m.growth.followOrg(await ev(), { email: "fan@example.com", consent: true });
    expect(again.id).toBe(f.id);
    expect(await m.growth.followerCount(orgId)).toBe(1);
    const list = await m.growth.listFollowers(hostId, orgId);
    expect(list[0]).toMatchObject({ email: "fan@example.com", instagram_username: "fan.one", event_name: "[TEST] Growth Night" });

    // The old unsubscribe key was replaced; the newest works.
    expect(await m.growth.unsubscribe(f.unsubscribeToken)).toBe(false);
    expect(await m.growth.unsubscribe(again.unsubscribeToken)).toBe(true);
    expect(await m.growth.followerCount(orgId)).toBe(0);
    expect(await m.growth.unsubscribe("bad token!")).toBe(false);
  });

  it("only the account's admins can download followers", async () => {
    const other = await m.hosts.signupHost({ email: `gr2-${Date.now()}@test.weparty`, password: "correct horse", displayName: "Other" });
    await expect(m.growth.listFollowers(other, orgId)).rejects.toThrow();
    await m.sql`delete from organizations where id in (select org_id from org_members where host_id = ${other})`;
    await m.sql`delete from hosts where id = ${other}`;
  });

  it("records which version of the host terms was accepted", async () => {
    await m.growth.recordTermsAccepted(eventId);
    const e = await ev();
    expect((e as unknown as { terms_version: string }).terms_version).toBe(m.growth.HOST_TERMS_VERSION);
  });
});
