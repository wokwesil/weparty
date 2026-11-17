// Accessibility audit: runs axe-core and a 44px tap-target check on every main screen.
// Usage: start the app (WEPARTY_TEST_CATALOG=1, optionally FEATURE_* switches on), then
//   BASE_URL=http://localhost:3000 node tests/e2e/a11y-audit.mjs
// Prints the party code it created (for Lighthouse) and exits non-zero on serious problems.
import { chromium, devices } from "playwright";
import fs from "node:fs";
import { createRequire } from "node:module";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch();
let problems = 0;

async function audit(page, label) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }),
  );
  const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  // Tap targets: visible buttons/links/inputs smaller than 44x44 (inline text links are exempt).
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, [role=tab]")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || el.closest("[aria-hidden=true]")) continue;
      const inlineText = el.tagName === "A" && style.display === "inline";
      if (inlineText) continue;
      if (el.type === "checkbox" || el.type === "file") continue; // the whole label is the target
      if (el.classList.contains("tap-area")) continue; // touch area is enlarged with an invisible ::after
      if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  console.log(`\n${label}: ${bad.length ? `${bad.length} serious issue(s)` : "no serious axe issues"}${small.length ? `, ${small.length} small tap target(s)` : ""}`);
  for (const v of bad) {
    console.log(`  ✗ [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) console.log(`      ${n.target.join(" ")} ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`);
  }
  for (const s of small.slice(0, 12)) console.log(`  · small: ${s}`);
  problems += bad.length + small.length;
}

try {
  const host = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await host.goto(`${BASE}/`);
  await audit(host, "Landing");
  await host.goto(`${BASE}/host/signup`);
  await audit(host, "Host sign-up");
  await host.getByPlaceholder("Your name").fill("Audit Host");
  await host.getByPlaceholder("Email").fill(`audit+${Date.now()}@test.weparty`);
  await host.getByPlaceholder("Password (8+ characters)").fill("party-password-1");
  await host.getByRole("button", { name: "Create account" }).click();
  await host.waitForURL(`${BASE}/host`);
  await audit(host, "Host dashboard");
  await host.locator('input[name="eventName"]').fill("Audit Night");
  const terms = host.getByRole("checkbox", { name: /host terms/ });
  if (await terms.count()) await terms.check();
  await host.getByRole("button", { name: "Create event + QR code" }).click();
  await host.waitForURL(/\/host\/events\/[0-9a-f-]{36}$/);
  const eventId = host.url().split("/").pop();
  await audit(host, "Control room");
  const ev = await (await host.request.get(`${BASE}/api/host/events/${eventId}/state`)).json();
  const code = ev.snapshot.event.code;

  const guests = [];
  for (const [i, ig] of ["audit_ana", "audit_ben"].entries()) {
    const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
    await page.goto(`${BASE}/e/${code}`);
    if (i === 0) await audit(page, "Join screen");
    await page.locator('input[name="instagram"]').fill(ig);
    await page.getByRole("button", { name: /PICK A SONG/ }).click();
    await page.waitForURL(/\/pick$/);
    await page.getByLabel("Search songs").fill(`Artist ${i + 1}`);
    const add = page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^Add \[TEST\]/ });
    await add.first().waitFor();
    await add.first().click();
    if (i === 0) await audit(page, "Pick songs");
    await page.getByRole("button", { name: /JOIN WITH 1 SONG/ }).click();
    await page.waitForURL(/\/party/);
    guests.push(page);
  }
  // Hearts so recap/taste have data
  const s = await (await guests[0].request.get(`${BASE}/api/e/${code}/state`)).json();
  for (const g of guests) for (const q of s.queue) await g.request.post(`${BASE}/api/e/${code}/vote`, { data: { itemId: q.id, on: true }, headers: { origin: BASE } }).catch(() => {});
  await guests[0].reload();
  await audit(guests[0], "Live party (queue)");
  await guests[0].getByRole("tab", { name: "People" }).click();
  await audit(guests[0], "Live party (people)");
  await guests[0].getByRole("tab", { name: "My requests" }).click();
  await audit(guests[0], "Live party (my requests)");

  await host.goto(`${BASE}/host/events/${eventId}/check`);
  await audit(host, "Party check");
  await host.goto(`${BASE}/host/events/${eventId}/insights`);
  await audit(host, "Insights");
  await host.goto(`${BASE}/host/events/${eventId}/poster`);
  await audit(host, "QR poster");

  await guests[0].goto(`${BASE}/e/${code}/replay`);
  await audit(guests[0], "Replay (guest)");
  for (const p of ["/pricing", "/terms", "/privacy", "/support"]) {
    const r = await host.goto(`${BASE}${p}`);
    if (r && r.status() === 200) await audit(host, p);
  }
  console.log(`\nPARTY_CODE=${code}`);
  console.log(problems ? `\n${problems} accessibility problem(s) found.` : "\nNo serious accessibility problems found.");
  process.exitCode = problems ? 1 : 0;
} finally {
  await browser.close();
}
