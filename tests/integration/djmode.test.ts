/**
 * Faster join, DJ Mode and reliability features against a real Postgres database.
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
  dj: typeof import("../../src/lib/services/dj");
};
let m: Mods;

const song = (n: number, extra: Record<string, unknown> = {}) => ({
  appleId: `dj-${n}`,
  title: `[TEST] Song ${n}`,
  artist: `[TEST] Artist ${n % 4}`,
  genre: n % 2 ? "Pop" : "Hip-Hop/Rap",
  ...extra,
});

d("DJ Mode, faster join and reliability (database)", () => {
  let hostId: string;
  let orgId: string;
  let eventId: string;
  const ev = async () => (await m.events.getEventById(eventId))!;
  const snap = async () => m.queue.getSnapshot(await ev());
  const join = async (ig: string) => (await m.guests.registerGuest(await ev(), { displayName: ig, instagram: ig })).guest;

  beforeAll(async () => {
    m = {
      sql: (await import("../../src/lib/db")).sql,
      hosts: await import("../../src/lib/services/hosts"),
      events: await import("../../src/lib/services/events"),
      guests: await import("../../src/lib/services/guests"),
      queue: await import("../../src/lib/services/queue"),
      dj: await import("../../src/lib/services/dj"),
    };
    hostId = await m.hosts.signupHost({ email: `dj-${Date.now()}@test.weparty`, password: "correct horse", displayName: "DJ Test" });
    orgId = (await m.hosts.getHostAccount(hostId))!.orgs[0].id;
    eventId = await m.events.createEvent(hostId, orgId, { name: "[TEST] DJ Night" });
  });

  afterAll(async () => {
    if (eventId) await m.sql`delete from events where id = ${eventId}`;
    if (hostId) await m.sql`delete from hosts where id = ${hostId}`;
    if (orgId) await m.sql`delete from organizations where id = ${orgId}`;
    await m.sql.end();
  });

  it("one song is enough to join, and guests can keep adding up to the host's limit", async () => {
    const a = await join("one.song");
    const r = await m.queue.submitSongs(await ev(), a, [song(1)]);
    expect(r).toMatchObject({ added: 1, total: 1, firstTime: true });
    // Add more later, one at a time
    for (let n = 2; n <= 15; n++) await m.queue.submitSongs(await ev(), a, [song(n)]);
    await expect(m.queue.submitSongs(await ev(), a, [song(16)])).rejects.toThrow(/already added your 15/);
    // Host lowers the limit for the next guests
    await m.events.updateSettings(hostId, eventId, { maxPicks: 3 });
    const b = await join("limited");
    await expect(m.queue.submitSongs(await ev(), b, [song(20), song(21), song(22), song(23)])).rejects.toThrow(/can add 3 more/);
    await m.events.updateSettings(hostId, eventId, { maxPicks: 15 });
  });

  it("the shared queue snapshot updates as soon as anything changes", async () => {
    const before = await snap();
    const g = await join("cache.check");
    await m.queue.submitSongs(await ev(), g, [song(30)]);
    const after = await snap();
    expect(after.queue.length).toBe(before.queue.length + 1);
    // Same version = same shared object (no extra database work)
    expect(await snap()).toBe(after);
  });

  it("approval mode: requests wait for the DJ, who approves or declines", async () => {
    await m.events.updateSettings(hostId, eventId, { djMode: true, approvalMode: true });
    const g = await join("needs.approval");
    const r = await m.queue.submitSongs(await ev(), g, [song(40), song(41)]);
    expect(r.pending).toBe(2);
    let s = await snap();
    expect(s.pending.map((p) => p.appleSongId).sort()).toEqual(["dj-40", "dj-41"]);
    expect(s.queue.find((q) => q.appleSongId === "dj-40")).toBeUndefined();
    // Guests see their own waiting songs, and can't heart pending songs
    const act = await m.queue.getGuestActivity(g.id);
    expect(act.myPending.map((p) => p.status)).toEqual(["pending", "pending"]);
    const other = await join("other.voter");
    await expect(m.queue.setVote(await ev(), other, s.pending[0].id, true)).rejects.toThrow(/waiting for the DJ/);

    const p40 = s.pending.find((p) => p.appleSongId === "dj-40")!;
    const p41 = s.pending.find((p) => p.appleSongId === "dj-41")!;
    await m.queue.hostQueueAction(hostId, eventId, { type: "approve", itemId: p40.id });
    await m.queue.hostQueueAction(hostId, eventId, { type: "decline", itemId: p41.id });
    s = await snap();
    expect(s.queue.some((q) => q.id === p40.id)).toBe(true);
    expect(s.pending).toHaveLength(0);
    // A declined song can't be requested again tonight, and doesn't count toward the limit
    await expect(m.queue.submitSongs(await ev(), other, [song(41)])).rejects.toThrow(/passed on/);
    expect((await m.queue.getGuestActivity(g.id)).mySongIds).toHaveLength(1);
    // Turning approval off lets anything still waiting straight in
    await m.queue.submitSongs(await ev(), other, [song(42)]);
    await m.events.updateSettings(hostId, eventId, { approvalMode: false });
    s = await snap();
    expect(s.queue.some((q) => q.appleSongId === "dj-42")).toBe(true);
  });

  it("locked songs can't be moved by votes; votes reorder what comes after", async () => {
    await m.events.updateSettings(hostId, eventId, { lockCount: 3 });
    let s = await snap();
    const locked = s.queue.slice(0, 3).map((q) => q.id);
    expect(s.queue.slice(0, 3).every((q) => q.locked)).toBe(true);
    expect(s.queue[3].locked).toBe(false);
    // Everyone hearts the last song
    const last = s.queue[s.queue.length - 1];
    const voters = [];
    for (let i = 0; i < 6; i++) voters.push(await join(`voter${i}`));
    for (const v of voters) await m.queue.setVote(await ev(), v, last.id, true);
    s = await snap();
    expect(s.queue.slice(0, 3).map((q) => q.id)).toEqual(locked);
    expect(s.queue[3].id).toBe(last.id);
    // After a song plays, the next crowd favorite slides into the lock
    await m.queue.hostQueueAction(hostId, eventId, { type: "next" });
    s = await snap();
    expect(s.nowPlaying!.id).toBe(locked[0]);
    expect(s.queue.slice(0, 3).map((q) => q.id)).toEqual([locked[1], locked[2], last.id]);
    expect(s.queue.slice(0, 3).every((q) => q.locked)).toBe(true);
    // Turning the lock off hands control back to the crowd
    await m.events.updateSettings(hostId, eventId, { lockCount: 0 });
    s = await snap();
    expect(s.queue.some((q) => q.locked || q.pinned)).toBe(false);
  });

  it("blocklist removes matching songs and blocks new requests, including features", async () => {
    const g = await join("blocked.fan");
    await m.queue.submitSongs(await ev(), g, [song(60, { artist: "Big Star feat. Someone" }), song(61)]);
    const r = await m.dj.addBlock(hostId, eventId, { kind: "artist", value: "Big Star", label: "Big Star" });
    expect(r.removed).toBe(1);
    expect((await snap()).queue.some((q) => q.appleSongId === "dj-60")).toBe(false);
    await expect(m.queue.submitSongs(await ev(), g, [song(62, { artist: "Other & Big Star" })])).rejects.toThrow(/isn't taking requests for Big Star/);
    // Not a false match for a different artist that starts with the same words
    await m.queue.submitSongs(await ev(), g, [song(63, { artist: "Big Star Tribute Band" })]);
    await m.dj.addBlock(hostId, eventId, { kind: "song", value: "dj-61", label: "Song 61" });
    expect((await snap()).queue.some((q) => q.appleSongId === "dj-61")).toBe(false);
    const blocks = await m.dj.listBlocks(eventId);
    expect(blocks).toHaveLength(2);
    await m.dj.removeBlock(hostId, eventId, blocks.find((b) => b.kind === "artist")!.id);
    await m.queue.submitSongs(await ev(), await join("after.unblock"), [song(64, { artist: "Big Star" })]);
  });

  it("explicit filter removes explicit songs waiting in the queue and blocks new ones", async () => {
    const g = await join("explicit.fan");
    await m.queue.submitSongs(await ev(), g, [song(70, { explicit: true })]);
    await m.events.updateSettings(hostId, eventId, { allowExplicit: false });
    expect((await snap()).queue.some((q) => q.appleSongId === "dj-70")).toBe(false);
    await expect(m.queue.submitSongs(await ev(), g, [song(71, { explicit: true })])).rejects.toThrow(/clean-only/);
    await m.events.updateSettings(hostId, eventId, { allowExplicit: true });
  });

  it("DJ Spotlight and shoutouts reach every guest", async () => {
    await m.events.updateSettings(hostId, eventId, { djName: "Nova", djInstagram: "@DJ.Nova" });
    let s = await snap();
    expect(s.event.dj).toEqual({ name: "Nova", instagram: "dj.nova", photoUrl: null });
    await m.dj.postShoutout(hostId, eventId, "  Last call for requests!  ");
    s = await snap();
    expect(s.shoutout?.message).toBe("Last call for requests!");
    await m.dj.clearShoutouts(hostId, eventId);
    expect((await snap()).shoutout).toBeNull();
    // DJ Mode off hides the Spotlight
    await m.events.updateSettings(hostId, eventId, { djMode: false });
    expect((await snap()).event.dj).toBeNull();
    await m.events.updateSettings(hostId, eventId, { djMode: true });
  });

  it("Crowd Pulse shows trending songs, artists, genres and activity", async () => {
    const pulse = await m.dj.getCrowdPulse(eventId);
    expect(pulse.trending.length).toBeGreaterThan(0);
    expect(pulse.topArtists.length).toBeGreaterThan(0);
    expect(pulse.genres.map((g) => g.genre)).toEqual(expect.arrayContaining(["Pop", "Hip-Hop/Rap"]));
    expect(pulse.activity.reduce((t, a) => t + a.requests, 0)).toBeGreaterThan(0);
  });

  it("tracks join drop-off per step and time to join", async () => {
    for (const [dev, steps] of [
      ["device-aaaa1", ["scanned", "profile", "picked", "joined"]],
      ["device-bbbb2", ["scanned", "profile"]],
      ["device-cccc3", ["scanned"]],
    ] as const) {
      for (const st of steps) await m.dj.recordFunnel(eventId, dev, st);
    }
    await m.dj.recordFunnel(eventId, "device-aaaa1", "scanned"); // repeats don't double count
    const f = await m.dj.getFunnel(eventId);
    expect(f.steps.map((s) => s.count)).toEqual([3, 2, 1, 1]);
    expect(f.medianSecondsToJoin).not.toBeNull();
    expect(f.under30s).toBe(1);
    await expect(m.dj.recordFunnel(eventId, "x", "scanned")).rejects.toThrow(/device/);
    await expect(m.dj.recordFunnel(eventId, "device-dddd4", "hacked")).rejects.toThrow(/Unknown step/);
  });

  it("guests can report someone once; the host sees it", async () => {
    const a = await join("reporter");
    const b = await join("rude.guest");
    await m.dj.reportGuest(await ev(), a, b.id, "Spamming");
    await m.dj.reportGuest(await ev(), a, b.id, "Still spamming"); // updates, doesn't duplicate
    await expect(m.dj.reportGuest(await ev(), a, a.id, "me")).rejects.toThrow(/yourself/);
    const reports = await m.dj.listReports(eventId);
    expect(reports.filter((r) => r.guestId === b.id)).toHaveLength(1);
    expect(reports[0].reason).toBe("Still spamming");
  });

  it("Party check reports what's ready", async () => {
    const items = await m.dj.getPartyCheck(hostId, eventId, "https://weparty.example/e/abc");
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.live.ok).toBe(true);
    expect(byId.requests.ok).toBe(true);
    expect(byId.database.ok).toBe(true);
    expect(byId.test_guest.ok).toBe(true);
    expect(byId.dj.ok).toBe(true);
    await m.events.setSubmissionsOpen(hostId, eventId, false);
    const paused = await m.dj.getPartyCheck(hostId, eventId, "https://weparty.example/e/abc");
    expect(paused.find((i) => i.id === "requests")!.ok).toBe(false);
    await m.events.setSubmissionsOpen(hostId, eventId, true);
  });
  it("tonight's vibes: only songs in the host's vibes get in, host songs and unknown genres still do", async () => {
    await m.events.updateSettings(hostId, eventId, { vibes: ["old-school-hip-hop", "not-a-vibe"] as string[], vibesOnly: true, vibePrices: { "old-school-hip-hop": 500 } });
    const e = await ev();
    const pub = m.events.toPublicEvent(e);
    expect(pub.vibes.map((v) => v.id)).toEqual(["old-school-hip-hop"]);
    expect(pub.vibesOnly).toBe(true);
    expect(JSON.stringify(pub)).not.toContain("500"); // prices are never sent to guests
    const g = await join("vibe.guest");
    await expect(m.queue.submitSongs(e, g, [song(901, { genre: "Country" })])).rejects.toThrow(/isn't tonight's vibe/);
    await expect(m.queue.submitSongs(e, g, [song(902, { genre: "Hip-Hop/Rap" })])).resolves.toMatchObject({ added: 1 });
    await expect(m.queue.submitSongs(e, g, [song(903, { genre: null })])).resolves.toMatchObject({ added: 1 });
    await m.queue.hostAddSong(hostId, eventId, song(904, { genre: "Country" }));
    // Switch strict off: anything goes again.
    await m.events.updateSettings(hostId, eventId, { vibesOnly: false });
    await expect(m.queue.submitSongs(await ev(), g, [song(905, { genre: "Country" })])).resolves.toMatchObject({ added: 1 });
    await m.events.updateSettings(hostId, eventId, { vibes: [], vibesOnly: true });
  });
});
