// Load test: a real party's worth of guests hitting the server at once.
// Usage: start the app (WEPARTY_TEST_CATALOG=1), then
//   BASE_URL=http://localhost:3000 GUESTS=150 JOIN_SECONDS=120 VOTES=600 node tests/load/party-load.mjs
// Every guest keeps polling the live queue every 4 seconds the whole time
// (the worst case: live updates switched off), while hosts run the music.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const GUESTS = Number(process.env.GUESTS ?? 150);
const JOIN_SECONDS = Number(process.env.JOIN_SECONDS ?? 120);
const VOTES = Number(process.env.VOTES ?? 600);
const POLL_MS = Number(process.env.POLL_MS ?? 4000);

const stats = new Map(); // name -> { ms: [], errors: 0, codes: {} }
const rec = (name, ms, ok, code) => {
  const s = stats.get(name) ?? { ms: [], errors: 0, codes: {} };
  s.ms.push(ms);
  if (!ok) {
    s.errors++;
    s.codes[code] = (s.codes[code] ?? 0) + 1;
  }
  stats.set(name, s);
};

async function call(name, path, { method = "GET", body, cookie, device, raw } = {}) {
  const t = performance.now();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        Origin: BASE,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(device ? { "x-wp-device": device } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
  } catch (e) {
    rec(name, performance.now() - t, false, "network");
    throw e;
  }
  const text = await res.text();
  const ok = res.status < 400;
  rec(name, performance.now() - t, ok, res.status);
  if (raw) return res;
  return { res, json: text.startsWith("{") ? JSON.parse(text) : null };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Host sets up the event ---------------------------------------------
const email = `load+${Date.now()}@test.weparty`;
const signup = await fetch(`${BASE}/api/host/signup`, {
  method: "POST",
  headers: { Origin: BASE, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "load-test-password", displayName: "[TEST] Load Host" }),
});
const hostCookie = signup.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const created = await (await fetch(`${BASE}/api/host/events`, {
  method: "POST",
  headers: { Origin: BASE, "Content-Type": "application/json", Cookie: hostCookie },
  body: JSON.stringify({ name: "[TEST] Load test party" }),
})).json();
const eventId = created.id;
const events = await (await fetch(`${BASE}/api/host/events`, { headers: { Cookie: hostCookie } })).json();
const code = events.events.find((e) => e.id === eventId).code;
console.log(`Event ${code}: ${GUESTS} guests join over ${JOIN_SECONDS}s, ${VOTES} hearts, everyone polls every ${POLL_MS / 1000}s`);

// --- Guests ---------------------------------------------------------------
const guests = [];
let stop = false;
const pollers = [];

async function poll(g) {
  while (!stop) {
    await call("GET live queue", `/api/e/${code}/state`, { cookie: g.cookie, device: g.device }).catch(() => {});
    await sleep(POLL_MS * (0.8 + Math.random() * 0.4));
  }
}

async function guestJoins(i) {
  const device = `loaddevice${i}x${Date.now()}`;
  const t0 = performance.now();
  await call("open party page", `/e/${code}`, { device, raw: true });
  await call("funnel step", `/api/e/${code}/funnel`, { method: "POST", body: { device, step: "scanned" } });
  const j = await call("join", `/api/e/${code}/join`, { method: "POST", device, body: { displayName: `[TEST] Guest ${i}`, instagram: `load_${i}_${code}` } });
  if (!j.res.ok) return;
  const cookie = j.res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const g = { i, device, cookie };
  await call("search", `/api/music/search?q=${encodeURIComponent(`Artist ${(i % 12) + 1}`)}`, { device });
  const n = 1 + (i % 3);
  const songs = Array.from({ length: n }, (_, k) => {
    const id = ((i * 7 + k * 13) % 60) + 1;
    return { appleId: `test-${id}`, title: `[TEST] Party Song ${id}`, artist: `[TEST] Artist ${((id - 1) % 12) + 1}`, genre: "Pop" };
  });
  await call("submit songs", `/api/e/${code}/songs`, { method: "POST", cookie, device, body: { songs } });
  await call("open live party page", `/e/${code}/party`, { cookie, device, raw: true });
  rec("QR scan → in the party (server time)", performance.now() - t0, true);
  guests.push(g);
  pollers.push(poll(g));
}

const started = performance.now();
const joins = [];
for (let i = 0; i < GUESTS; i++) {
  joins.push(guestJoins(i).catch((e) => console.error("guest", i, e.message)));
  await sleep((JOIN_SECONDS * 1000) / GUESTS);
}
await Promise.all(joins);
console.log(`All guests joined after ${((performance.now() - started) / 1000).toFixed(0)}s`);

// --- Hearts storm + host plays songs -----------------------------------
const state = (await call("GET live queue", `/api/e/${code}/state`, { cookie: guests[0].cookie })).json;
const ids = state.queue.map((q) => q.id);
let sent = 0;
const hostLoop = (async () => {
  while (!stop) {
    await call("host: next song", `/api/host/events/${eventId}/queue`, { method: "POST", cookie: hostCookie, body: { type: "next" } });
    await call("host: control room refresh", `/api/host/events/${eventId}/state`, { cookie: hostCookie });
    await sleep(3000);
  }
})();
const voteStart = performance.now();
await Promise.all(
  Array.from({ length: 25 }, async () => {
    while (sent < VOTES) {
      sent++;
      const g = guests[Math.floor(Math.random() * guests.length)];
      const id = ids[Math.floor(Math.random() * ids.length)];
      await call("heart", `/api/e/${code}/votes`, { method: "POST", cookie: g.cookie, device: g.device, body: { itemId: id, on: true } }).catch(() => {});
    }
  }),
);
console.log(`${VOTES} hearts sent in ${((performance.now() - voteStart) / 1000).toFixed(1)}s`);
await sleep(POLL_MS * 2);
stop = true;
await Promise.all([hostLoop, ...pollers]);

// --- Verify + report ---------------------------------------------------
const final = (await call("GET live queue", `/api/e/${code}/state`, { cookie: guests[0].cookie })).json;
const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((arr.length * p) / 100))];
console.log("\nRequest type                         count   p50 ms   p95 ms   max ms  errors");
let failed = 0;
for (const [name, s] of stats) {
  if (name.startsWith("heart")) {
    // "own song" (400) is expected: random guests sometimes heart their own pick
    failed += Object.entries(s.codes).filter(([c]) => c !== "400").reduce((t, [, n]) => t + n, 0);
  } else failed += s.errors;
  console.log(
    `${name.padEnd(36)} ${String(s.ms.length).padStart(5)} ${String(Math.round(pct(s.ms, 50))).padStart(8)} ${String(Math.round(pct(s.ms, 95))).padStart(8)} ${String(Math.round(Math.max(...s.ms))).padStart(8)}  ${s.errors ? JSON.stringify(s.codes) : "0"}`,
  );
}
console.log(`\nGuests in the party: ${final.stats.guests}/${GUESTS}. Hearts counted: ${final.stats.votes}. Songs: ${final.stats.songs}. Played: ${final.stats.played}.`);
const ok = final.stats.guests === GUESTS && failed === 0;
console.log(ok ? "LOAD TEST PASSED" : `LOAD TEST FAILED (${failed} unexpected errors)`);
process.exitCode = ok ? 0 : 1;
