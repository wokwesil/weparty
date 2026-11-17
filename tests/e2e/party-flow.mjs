// End-to-end test: a host and several guests on phones run a whole party in real browsers.
// Usage: start the app (WEPARTY_TEST_CATALOG=1), then
//   BASE_URL=http://localhost:3000 GUESTS=6 node tests/e2e/party-flow.mjs
// Screenshots are saved to tests/e2e/screenshots/.
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const GUESTS = Number(process.env.GUESTS ?? 6);
const SHOTS = path.join(process.cwd(), "tests/e2e/screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const check = (cond, label) => {
  if (!cond) throw new Error(`FAILED: ${label}`);
  passed++;
  console.log(`  ✓ ${label}`);
};

// Tiny solid-color PNG for profile photos.
function png(r, g, b) {
  const w = 64, h = 64;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

try {
  console.log("Host sets up an event");
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const host = await hostCtx.newPage();
  await host.goto(`${BASE}/`);
  await shot(host, "01-landing-desktop");
  await host.goto(`${BASE}/host/signup`);
  await host.getByPlaceholder("Your name").fill("William");
  await host.getByPlaceholder("Brand, venue or DJ name (optional)").fill("WeParty Launch");
  await host.getByPlaceholder("Email").fill(`william+${Date.now()}@test.weparty`);
  await host.getByPlaceholder("Password (8+ characters)").fill("party-password-1");
  await host.getByRole("button", { name: "Create account" }).click();
  await host.waitForURL(`${BASE}/host`);
  check(true, "host account created");
  await host.locator('input[name="eventName"]').fill("WeParty Launch Night");
  await host.getByPlaceholder("Venue (optional)").fill("The Loft");
  const terms = host.getByRole("checkbox", { name: /host terms/ });
  if (await terms.count()) await terms.check(); // only shown when FEATURE_TERMS=1
  await host.getByRole("button", { name: "Create event + QR code" }).click();
  await host.waitForURL(/\/host\/events\/[0-9a-f-]{36}$/);
  const eventId = host.url().split("/").pop();
  check(Boolean(eventId), "event created");
  await host.getByRole("tab", { name: /QR, details/ }).click();
  const joinUrl = (await host.locator("p.font-mono").first().textContent()).trim();
  const code = joinUrl.split("/e/")[1];
  check(/^[a-z0-9]{6}$/.test(code), `event has QR link ${joinUrl}`);
  const qr = await host.request.get(`${BASE}/api/host/events/${eventId}/qr?format=png`);
  check(qr.ok() && qr.headers()["content-type"] === "image/png", "QR code PNG downloads");
  await shot(host, "06-host-qr");

  console.log(`${GUESTS} guests scan the QR code`);
  const phones = [];
  for (let i = 0; i < GUESTS; i++) {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    phones.push({ ctx, page, ig: `guest_${i}_${code}` });
  }

  const joinTimes = [];
  for (const [i, p] of phones.entries()) {
    const { page } = p;
    const t0 = Date.now();
    await page.goto(joinUrl);
    // Joining is on the first screen now: no extra "enter" tap.
    await page.locator('input[name="instagram"]').waitFor();
    if (i === 0) await shot(page, "02-event-welcome-phone");
    // Photo is optional: half the guests skip it.
    if (i % 2 === 0) {
      await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png(40 * i, 120, 255 - 30 * i) });
    }
    await page.locator('input[name="instagram"]').fill(`@${p.ig}`);
    if (i % 3 !== 2) await page.locator('input[name="displayName"]').fill(`Guest ${i + 1}`); // display name optional
    if (i === 0) await shot(page, "03-join-phone");
    await page.getByRole("button", { name: /PICK A SONG/ }).click();
    await page.waitForURL(/\/pick$/);
    await page.getByLabel("Search songs").fill(`Artist ${(i % 12) + 1}`);
    await page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^Add \[TEST\]/ }).first().waitFor();
    // Guests pick 1 to 3 songs (one song is enough to join; some overlap on purpose)
    const want = (i % 3) + 1;
    for (let k = 0; k < want; k++) await page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^Add \[TEST\]/ }).first().click();
    if (i === 0) await shot(page, "04-pick-tracks-phone");
    await page.getByRole("button", { name: new RegExp(`JOIN WITH ${want} SONG`) }).click();
    await page.waitForURL(/\/party/);
    await page.getByText("LIVE QUEUE", { exact: false }).first().waitFor();
    joinTimes.push(Date.now() - t0);
  }
  check(true, `${GUESTS} guests joined with 1 to 3 songs each`);
  const slowest = Math.max(...joinTimes);
  check(slowest < 30000, `QR scan to "in the party" took ${(slowest / 1000).toFixed(1)}s at most (goal: under 30s, robot typing)`);

  // "Add more songs" inside the live party
  {
    const page = phones[0].page;
    await page.getByRole("link", { name: /Add more songs/ }).click();
    await page.waitForURL(/\/pick$/);
    await page.getByLabel("Search songs").fill("Party Song 5");
    await page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^Add \[TEST\]/ }).first().click();
    await page.getByRole("button", { name: /ADD 1 SONG/ }).click();
    await page.waitForURL(/\/party/);
    const me = (await (await page.request.get(`${BASE}/api/e/${code}/state`)).json()).me;
    check(me.songsSubmitted === 2, "guest added another song from inside the party");
  }

  const state = async (page) => (await page.request.get(`${BASE}/api/e/${code}/state`)).json();
  let s = await state(phones[0].page);
  check(s.stats.guests === GUESTS, `queue shows ${GUESTS} guests`);
  check(s.queue.length > 0 && s.queue.every((q) => q.title && q.artist), `queue has ${s.queue.length} songs with titles and artists`);
  check(s.queue.every((q) => q.requester?.instagram), "every song shows who requested it");
  check(new Set(s.queue.map((q) => q.appleSongId)).size === s.queue.length, "no duplicate songs in the queue");
  const firstRequesters = new Set(s.queue.slice(0, Math.min(GUESTS, 4)).map((q) => q.requester.id));
  check(firstRequesters.size === Math.min(GUESTS, 4), "fair rotation: top of the queue comes from different guests");
  const people = await (await phones[0].page.request.get(`${BASE}/api/e/${code}/people`)).json();
  check(people.people.length === GUESTS && people.people.filter((p) => p.avatarUrl).length === Math.ceil(GUESTS / 2), "guests can see everyone; photos show for those who added one");
  const avatar = await phones[0].page.request.get(`${BASE}${people.people[0].avatarUrl}`);
  check(avatar.ok() && avatar.headers()["content-type"] === "image/jpeg", "profile photo served (resized to JPEG on the phone)");

  console.log("Guests heart songs");
  const target = s.queue[s.queue.length - 1];
  const voters = phones.filter((p) => !target.requester || p.ig !== target.requester.instagram);
  for (const p of voters.slice(0, 4)) {
    const r = await p.page.request.post(`${BASE}/api/e/${code}/votes`, { data: { itemId: target.id, on: true }, headers: { Origin: BASE } });
    check(r.ok(), `@${p.ig} hearts "${target.title}"`);
  }
  const dup = await voters[0].page.request.post(`${BASE}/api/e/${code}/votes`, { data: { itemId: target.id, on: true }, headers: { Origin: BASE } });
  check((await dup.json()).votes === Math.min(4, voters.length), "duplicate heart doesn't count twice");
  s = await state(phones[0].page);
  const moved = s.queue.find((q) => q.id === target.id);
  check(moved.position < target.position, `hearted song moved up from #${target.position} to #${moved.position}`);

  // Heart by tapping in the UI, then confirm another phone sees it update live.
  const tapper = phones[phones.length - 1].page;
  await tapper.reload();
  const heart = tapper.getByRole("button", { name: "Heart this song" }).first();
  await heart.click();
  await tapper.waitForTimeout(500);
  const watcher = phones[0].page;
  await watcher.waitForFunction(
    async ([c, total]) => {
      const r = await fetch(`/api/e/${c}/state`);
      const j = await r.json();
      return j.stats.votes >= total;
    },
    [code, Math.min(4, voters.length) + 1],
    { timeout: 10000 },
  );
  check(true, "a heart tapped on one phone shows up on the others");
  await watcher.waitForTimeout(4500); // let the polling refresh render
  await shot(watcher, "05-live-queue-phone");

  console.log("Host runs the music");
  await host.getByRole("tab", { name: "Live queue" }).click();
  await host.getByRole("button", { name: /Start next song/ }).click();
  await host.getByText("Now playing:").first().waitFor().catch(() => {});
  await host.waitForTimeout(600);
  s = await state(phones[1].page);
  check(Boolean(s.nowPlaying), `NOW PLAYING: ${s.nowPlaying?.title}`);
  const first = s.nowPlaying;
  await host.getByRole("button", { name: /Next song/ }).click();
  await host.waitForTimeout(600);
  await host.getByRole("button", { name: /Next song/ }).click();
  await host.waitForTimeout(600);
  s = await state(phones[1].page);
  check(s.history.length === 2 && s.history[s.history.length - 1].id === first.id, "playback history is recorded in order");
  await shot(host, "07-host-control-room");

  const npBefore = s.nowPlaying.id;
  // Host override: move the last song to the top
  const lastSong = s.queue[s.queue.length - 1];
  const mv = await host.request.post(`${BASE}/api/host/events/${eventId}/queue`, { data: { type: "move", itemId: lastSong.id, toIndex: 0 }, headers: { Origin: BASE } });
  check(mv.ok(), "host moves a song to the top");
  s = await state(phones[1].page);
  check(s.queue[0].id === lastSong.id && s.nowPlaying.id === npBefore, "host override applied and the playing song didn't move");

  console.log("DJ Mode");
  const hostApi = (path, body, method = "POST") =>
    host.request.fetch(`${BASE}/api/host/events/${eventId}${path}`, { method, data: body, headers: { Origin: BASE } });
  check((await hostApi("/settings", { djMode: true, approvalMode: true, lockCount: 2, djName: "Nova", djInstagram: "dj.nova" }, "PATCH")).ok(), "host turns on DJ Mode with approval and a 2-song lock");
  await host.reload();
  await host.getByText("DJ Booth").first().waitFor();
  check(true, 'control room is called "DJ Booth" in DJ Mode');
  // A guest requests a song: it waits for approval
  {
    const page = phones[1].page;
    await page.goto(`${BASE}/e/${code}/pick`);
    await page.getByLabel("Search songs").fill("Party Song 47");
    await page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^Add \[TEST\]/ }).first().click();
    await page.getByRole("button", { name: /ADD 1 SONG/ }).click();
    await page.waitForURL(/\/party/);
    await page.getByText(/waiting for approval/).first().waitFor();
    check(true, "guest sees their request is waiting for the DJ");
    await page.getByText("DJ Nova").first().waitFor();
    check(true, "guest screen shows the DJ Spotlight");
  }
  s = await state(phones[0].page);
  check(s.event.approvalMode && s.queue.every((q) => q.title !== "[TEST] Party Song 47"), "pending song is not in the queue yet");
  check(s.queue.slice(0, 2).every((q) => q.locked), "next 2 songs are locked");
  await host.getByRole("tab", { name: /Booth/ }).click();
  await host.getByRole("button", { name: "Approve [TEST] Party Song 47" }).click();
  await host.waitForTimeout(800);
  s = await state(phones[0].page);
  check(s.queue.some((q) => q.title === "[TEST] Party Song 47"), "DJ approves with one big tap and the song joins the queue");
  await shot(host, "07b-dj-booth");
  // Shoutout reaches guests
  check((await hostApi("/shoutout", { message: "Last call for requests!" })).ok(), "DJ sends a shoutout");
  await phones[2].page.getByText("Last call for requests!").waitFor({ timeout: 25000 });
  check(true, "shoutout appears on a guest's screen");
  await shot(phones[2].page, "05b-guest-shoutout-phone");
  // Blocklist
  const blockTarget = s.queue[s.queue.length - 1];
  check((await hostApi("/blocklist", { kind: "artist", value: blockTarget.artist, label: blockTarget.artist })).ok(), `DJ blocks ${blockTarget.artist}`);
  s = await state(phones[0].page);
  check(!s.queue.some((q) => q.artist === blockTarget.artist), "blocked artist's songs leave the queue");
  const pulse = await (await host.request.get(`${BASE}/api/host/events/${eventId}/pulse`)).json();
  check(pulse.topArtists.length > 0 && pulse.genres.length > 0, "Crowd Pulse shows top artists and genres");
  check((await hostApi("/settings", { approvalMode: false, lockCount: 0 }, "PATCH")).ok(), "DJ turns approval and lock off again");

  // Party check
  await host.goto(`${BASE}/host/events/${eventId}/check`);
  await host.getByText("Party check").first().waitFor();
  check((await host.getByText("Database is connected").count()) === 1, "Party check page shows the event's readiness");
  await shot(host, "13-party-check");
  await host.goto(`${BASE}/host/events/${eventId}`);
  await host.getByText("DJ Booth").first().waitFor();

  // In-app report
  const report = await phones[0].page.request.post(`${BASE}/api/e/${code}/report`, { data: { guestId: people.people[1].id, reason: "Spamming requests" }, headers: { Origin: BASE } });
  check(report.ok(), "a guest can report another guest to the host");

  console.log("Security checks");
  const stranger = await browser.newContext();
  const sp = await stranger.newPage();
  check((await sp.request.get(`${BASE}/api/e/${code}/state`)).status() === 401, "people who haven't joined can't read the queue");
  check((await phones[0].page.request.post(`${BASE}/api/host/events/${eventId}/queue`, { data: { type: "next" }, headers: { Origin: BASE } })).status() === 401, "guests can't use host controls");
  check((await sp.request.post(`${BASE}/api/e/${code}/votes`, { data: { itemId: target.id }, headers: { Origin: BASE } })).status() === 401, "can't vote without joining");
  check((await phones[0].page.request.post(`${BASE}/api/e/${code}/votes`, { data: { itemId: target.id }, headers: { Origin: "https://evil.example" } })).status() === 403, "cross-site requests are blocked");
  await stranger.close();

  console.log("Host ends the event");
  await host.getByRole("button", { name: "End event" }).click();
  await host.getByRole("button", { name: "Tap again to end" }).click();
  await host.waitForTimeout(800);
  s = await state(phones[2].page);
  check(s.event.status === "ended", "event ended");

  const g = phones[2].page;
  await g.goto(`${BASE}/e/${code}/replay`);
  await g.getByText("Songs played, in order").waitFor();
  const rows = await g.locator("ol").first().locator("li").count();
  check(rows === 3, `replay lists the 3 songs actually played (got ${rows})`);
  await shot(g, "08-replay-phone");
  await g.screenshot({ path: path.join(SHOTS, "08b-replay-phone-full.png"), fullPage: true });
  const txt = await (await g.request.get(`${BASE}/e/${code}/replay/songs`)).text();
  check(txt.split("\n").filter((l) => /^\d+\. /.test(l)).length === 3, "replay song list downloads");
  const story = await g.request.get(`${BASE}/e/${code}/replay/story`);
  check(story.ok() && story.headers()["content-type"] === "image/png", "Instagram Story image renders");
  fs.writeFileSync(path.join(SHOTS, "09-instagram-story.png"), await story.body());

  if (s.growth) {
    console.log("Growth features (FEATURE_GROWTH=1)");
    await g.getByRole("heading", { name: "Your night in music" }).waitFor();
    check(true, "guest sees \"Your night in music\" on the replay");
    const mine = await g.request.get(`${BASE}/e/${code}/replay/me`);
    const png = await mine.body();
    check(mine.ok() && png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1920, "personal 9:16 story image renders (1080x1920)");
    fs.writeFileSync(path.join(SHOTS, "09b-my-night-story.png"), png);
    await g.getByPlaceholder("you@email.com").fill("fan@example.com");
    await g.getByRole("checkbox", { name: /Email me when they host/ }).check();
    await g.getByRole("button", { name: /^Follow / }).click();
    await g.getByText(/You're following/).waitFor();
    check(true, "guest followed the host by email (with consent)");
    check(await g.getByRole("link", { name: /Host your own party/ }).isVisible(), "replay shows \"Host your own party\" link");
    await shot(g, "08c-replay-growth-phone");
    const taste = await phones[0].page.request.get(`${BASE}/api/e/${code}/taste`);
    check(taste.ok() && Array.isArray((await taste.json()).matches), "taste matches load in the party");
  }
  const csv = await host.request.get(`${BASE}/api/host/events/${eventId}/export?list=played&format=csv`);
  check(csv.ok() && (await csv.text()).includes("Apple Music ID"), "host can export the played playlist as CSV");

  await host.goto(`${BASE}/host/events/${eventId}/insights`);
  await host.getByText("Most active contributors").waitFor();
  const funnelText = await host.getByText("In the party").first().isVisible();
  check(funnelText, "Insights shows the join drop-off steps");
  await shot(host, "10-host-insights");
  await host.screenshot({ path: path.join(SHOTS, "10b-host-insights-full.png"), fullPage: true });

  console.log("Returning guest joins the next party in one tap");
  const ev2 = await (await host.request.post(`${BASE}/api/host/events`, { data: { name: "WeParty Night Two", acceptTerms: true }, headers: { Origin: BASE } })).json();
  const ev2Code = (await (await host.request.get(`${BASE}/api/host/events`)).json()).events.find((e) => e.id === ev2.id).code;
  const back = phones[0].page;
  await back.goto(`${BASE}/e/${ev2Code}`);
  const oneTap = back.getByRole("button", { name: new RegExp(`JOIN AS @${phones[0].ig}`, "i") });
  await oneTap.waitFor();
  await shot(back, "03b-returning-guest-phone");
  await oneTap.click();
  await back.waitForURL(/\/pick$/);
  check(true, "returning guest rejoined with one tap (profile remembered on this phone)");
  await host.goto(`${BASE}/host/events/${eventId}/poster`);
  await shot(host, "11-qr-poster");
  await host.goto(`${BASE}/host`);
  await shot(host, "12-host-dashboard");

  console.log(`\nAll ${passed} checks passed.`);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
