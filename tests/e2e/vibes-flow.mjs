// "What's the vibe tonight?" end to end, with the test catalog.
//   WEPARTY_TEST_CATALOG=1 npm run build && WEPARTY_TEST_CATALOG=1 npm start   # one terminal
//   BASE_URL=http://localhost:3000 node tests/e2e/vibes-flow.mjs              # another
// Screenshots go to SHOTS (default tests/e2e/screenshots).
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? path.join(process.cwd(), "tests/e2e/screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

const browser = await chromium.launch();
try {
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const host = await hostCtx.newPage();
  await host.goto(`${BASE}/host/signup`);
  await host.getByPlaceholder("Your name").fill("Vibe Host");
  await host.getByPlaceholder("Email").fill(`vibes+${Date.now()}@test.weparty`);
  await host.getByPlaceholder("Password (8+ characters)").fill("party-password-1");
  await host.getByRole("button", { name: "Create account" }).click();
  await host.waitForURL(`${BASE}/host`);
  await host.locator('input[name="eventName"]').fill("[TEST] Throwback Thursday");
  const terms = host.getByRole("checkbox", { name: /host terms/ });
  if (await terms.count()) await terms.check();
  await host.getByRole("button", { name: "Create event + QR code" }).click();
  await host.waitForURL(/\/host\/events\/[0-9a-f-]{36}$/);
  const eventId = host.url().split("/").pop();

  await host.getByRole("tab", { name: /Tonight's vibes/ }).click();
  await host.getByRole("button", { name: /Old School Hip Hop/ }).click();
  await host.getByRole("button", { name: /^R&B SZA/ }).click();
  const price = host.getByLabel("Price for Old School Hip Hop");
  if (await price.count()) await price.fill("2.00");
  await host.getByRole("button", { name: "Save tonight's vibes" }).click();
  await host.getByRole("tab", { name: /Tonight's vibes \(2\)/ }).waitFor();
  check(true, "host picked 2 vibes");
  await shot(host, "vibes-01-host-picker");

  const state = await (await host.request.get(`${BASE}/api/host/events/${eventId}/state`)).json();
  check(state.settings.vibes.join() === "old-school-hip-hop,rnb", "vibes saved");
  const code = state.snapshot.event.code;
  check(!JSON.stringify(state.snapshot.event).includes("vibePrices"), "prices are not in the guest-facing event data");

  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/e/${code}`);
  await page.getByRole("list", { name: "Tonight's vibes" }).waitFor();
  check(true, "guest sees tonight's vibes on the welcome screen");
  await page.locator('input[name="instagram"]').fill(`@vibe_guest_${code}`);
  await shot(page, "vibes-02-guest-welcome");
  await page.getByRole("button", { name: /PICK A SONG/ }).click();
  await page.waitForURL(/\/pick$/);
  const crate = page.getByRole("list", { name: "Old School Hip Hop songs" });
  await crate.getByRole("button", { name: /^Add \[TEST\]/ }).first().waitFor();
  check((await crate.getByRole("listitem").count()) > 0, "Old School Hip Hop starter crate loads with no typing");
  await shot(page, "vibes-03-guest-crate");

  await page.getByRole("tab", { name: /All tonight's vibes/ }).click();
  await page.getByLabel("Search songs").fill("Party Song");
  const results = page.getByRole("list", { name: "Search results" });
  await results.getByRole("button", { name: /^Add \[TEST\]/ }).first().waitFor();
  check((await results.getByRole("listitem").count()) < 25, "search hides songs outside tonight's vibes");
  await results.getByRole("button", { name: /^Add \[TEST\]/ }).first().click();
  await shot(page, "vibes-04-guest-search");
  await page.getByRole("button", { name: /JOIN WITH 1 SONG/ }).click();
  await page.waitForURL(/\/party/);
  check(true, "guest joined with an in-vibe song");

  const off = await page.request.post(`${BASE}/api/e/${code}/songs`, {
    data: { songs: [{ appleId: "test-2", title: "[TEST] Party Song 2", artist: "[TEST] Artist 2", genre: "Pop" }] },
    headers: { Origin: BASE },
  });
  check(off.status() === 400 && /tonight's vibe/.test((await off.json()).error ?? JSON.stringify(await off.json())), "server refuses an off-vibe song");
  await page.getByRole("list", { name: "Tonight's vibes" }).waitFor();
  await shot(page, "vibes-05-guest-party");
} finally {
  await browser.close();
}
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("Vibes flow OK");
