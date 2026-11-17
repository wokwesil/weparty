// Browser test for the built-in host player (FEATURE_HOST_PLAYER=1), with a FAKE
// Apple MusicKit so it runs without a real Apple Music account.
// Usage: start the app with WEPARTY_TEST_CATALOG=1, FEATURE_HOST_PLAYER=1 and any
// APPLE_* test key (see docs/HOST_PLAYER.md), then
//   BASE_URL=http://localhost:3000 node tests/e2e/host-player.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = "tests/e2e/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const FAKE_MK = `
(() => {
  const listeners = {};
  const inst = {
    isAuthorized: false, playbackState: 0, currentPlaybackTime: 0, currentPlaybackDuration: 0, volume: 1,
    log: [],
    async authorize() { this.isAuthorized = true; return "user-token"; },
    async setQueue(o) { this.log.push("queue:" + o.song); if (o.startPlaying) this._set(2); this.currentPlaybackDuration = 200; },
    async play() { this.log.push("play"); this._set(2); },
    pause() { this.log.push("pause"); this._set(3); },
    stop() { this.log.push("stop"); this._set(4); },
    _set(s) { this.playbackState = s; (listeners.playbackStateDidChange || []).forEach(f => f({ state: s })); },
    addEventListener(n, f) { (listeners[n] ||= []).push(f); },
    removeEventListener(n, f) { listeners[n] = (listeners[n] || []).filter(x => x !== f); },
    api: { music: async () => ({ data: { data: [] } }) },
  };
  window.__mk = inst;
  window.MusicKit = { configure: async () => inst, getInstance: () => inst };
  document.dispatchEvent(new Event("musickitloaded"));
})();`;
let passed = 0;
const check = (c, l) => { if (!c) throw new Error("FAILED: " + l); passed++; console.log("  ✓ " + l); };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route("https://js-cdn.music.apple.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_MK }));
  const host = await ctx.newPage();
  await host.goto(`${BASE}/host/signup`);
  await host.getByPlaceholder("Your name").fill("Test Host");
  await host.getByPlaceholder("Email").fill(`host+${Date.now()}@test.weparty`);
  await host.getByPlaceholder("Password (8+ characters)").fill("party-password-1");
  await host.getByRole("button", { name: "Create account" }).click();
  await host.waitForURL(`${BASE}/host`);
  await host.locator('input[name="eventName"]').fill("[TEST] Player Night");
  await host.getByRole("button", { name: "Create event + QR code" }).click();
  await host.waitForURL(/\/host\/events\/[0-9a-f-]{36}$/);
  const eventId = host.url().split("/").pop();
  for (const [id, t] of [["1001", "Song A"], ["1002", "Song B"], ["1003", "Song C"]]) {
    const r = await host.request.post(`${BASE}/api/host/events/${eventId}/songs`, {
      headers: { Origin: BASE }, data: { song: { appleId: id, title: `[TEST] ${t}`, artist: "[TEST] Artist", album: null, artworkUrl: null, durationMs: 200000, isrc: null, appleUrl: null, previewUrl: null, explicit: false } },
    });
    if (!r.ok()) throw new Error(await r.text());
  }
  await host.reload();
  const playBtn = host.getByRole("button", { name: "▶ Play the queue here" });
  await playBtn.waitFor();
  check(true, "player shows when flag is on");
  await host.screenshot({ path: `${SHOTS}/host-player-off.png` });
  await playBtn.click();
  await host.waitForFunction(() => window.__mk?.log.some((l) => l.startsWith("queue:")));
  const first = await host.evaluate(() => window.__mk.log.find((l) => l.startsWith("queue:")));
  check(/queue:100[123]/.test(first), `starts the top song (${first})`);
  await host.getByText("Turn player off").waitFor();
  const npTitle = async () => (await host.locator('section[aria-label="WeParty player"] p.font-semibold').textContent());
  const t1 = await npTitle();
  check(t1.includes("[TEST] Song"), `now playing in WeParty: ${t1}`);
  await host.screenshot({ path: `${SHOTS}/host-player-on.png` });
  // Song ends -> queue should advance
  await host.evaluate(() => window.__mk._set(10));
  await host.waitForFunction((prev) => window.__mk.log.filter((l) => l.startsWith("queue:")).length >= 2, null, { timeout: 15000 });
  await host.waitForTimeout(1500);
  const t2 = await npTitle();
  check(t2 !== t1, `auto-advanced when song ended (${t1} → ${t2})`);
  // Double "ended"+"completed" must not skip twice
  const before = await host.evaluate(() => window.__mk.log.filter((l) => l.startsWith("queue:")).length);
  await host.evaluate(() => { window.__mk._set(5); window.__mk._set(10); });
  await host.waitForTimeout(3000);
  const after = await host.evaluate(() => window.__mk.log.filter((l) => l.startsWith("queue:")).length);
  check(after === before + 1, `ended+completed advanced once (${before} → ${after})`);
  // Manual "Next song" in control room -> player follows
  const t3 = await npTitle();
  const r = await host.request.post(`${BASE}/api/host/events/${eventId}/queue`, { headers: { Origin: BASE }, data: { type: "next" } });
  check(r.ok(), "next via control room");
  await host.waitForFunction((t) => document.querySelector('section[aria-label="WeParty player"] p.font-semibold')?.textContent !== t, t3, { timeout: 15000 });
  const t4 = await npTitle();
  check(t4 === "Queue is empty", `player follows manual Next (now: ${t4})`);
  check(await host.evaluate(() => window.__mk.log.at(-1) === "stop"), "player stops when queue is empty");
  // pause/play
  await host.getByRole("button", { name: "Turn player off" }).click();
  check(await host.getByRole("button", { name: "▶ Play the queue here" }).isVisible(), "player turns off");
  console.log(`${passed} checks passed`);
} finally { await browser.close(); }
