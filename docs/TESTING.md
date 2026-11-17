# Testing

## 1. Ranking + database tests (fast)

```bash
npm test                                   # ranking engine only
TEST_DATABASE_URL=postgres://... npm test  # plus a full simulated party on a real database
```

The DJ Mode database test covers 1-song joins and limits, approval mode,
song locks, the blocklist, the explicit filter, DJ Spotlight, shoutouts,
Crowd Pulse, join drop-off tracking, reports and the Party check.

The original database test runs a whole party: 5 guests join, Instagram handles are
cleaned, duplicate handles are rejected, song limits are enforced,
duplicate songs become extra requests, fairness puts 4 different people at the
top, hearts move songs up, duplicate and self-hearts are blocked, the host
plays, skips, removes and reorders, pinned songs hold against the crowd,
pausing blocks submissions, ending the event blocks changes, the replay lists
only songs actually played in the real order, and other hosts can't touch the
event while an invited DJ can run it but not delete it.

## 2. Full browser test (simulated phones)

```bash
WEPARTY_TEST_CATALOG=1 npm run build && WEPARTY_TEST_CATALOG=1 npm start   # in one terminal
BASE_URL=http://localhost:3000 GUESTS=8 npm run test:e2e                   # in another
```

A host signs up, creates an event, and downloads the QR code. Then N phones
(iPhone-sized browsers) open the QR link and join on that first screen (half
add a photo), search, join with 1 to 3 songs, and land in the live queue. One
adds another song from inside the party. The host turns on DJ Mode: approval,
locks, Spotlight, a shoutout that appears on a guest's phone, the blocklist,
Crowd Pulse and the Party check. A returning guest joins a second party in one tap. The test checks
hearts reorder the queue and show up on other phones, the host runs Next song,
override and End event, and the replay, Story image and CSV export all work.
It also checks security: non-guests can't read the queue, guests can't use host
controls, and cross-site requests are blocked. Screenshots go to
`tests/e2e/screenshots/`.

`WEPARTY_TEST_CATALOG=1` swaps Apple search for a built-in list of clearly
labelled `[TEST]` songs so tests don't need the internet. **Never set it in production.**

## 3. Load test (a real party's worth of phones)

```bash
WEPARTY_TEST_CATALOG=1 npm run build && WEPARTY_TEST_CATALOG=1 npm start   # in one terminal
BASE_URL=http://localhost:3000 GUESTS=150 JOIN_SECONDS=90 VOTES=600 npm run test:load
```

150 guests open the party page, join, search, pick 1 to 3 songs and open the
live party, while every guest keeps polling the queue every 4 seconds (the worst
case, with live updates off), 600 hearts arrive in a burst, and the host keeps
pressing Next song. It prints timings for every kind of request.

## Last results (Nov 17, 2026)

- Unit + database: 32 of 32 passed (16 unit, 16 on a real Postgres database)
- Browser: 51 of 51 checks passed with 8 simulated guests (joining took under 4 s each)
- Load (local Postgres): 150/150 guests joined over 90 s, 600 hearts in 3 s,
  2,176 live-queue refreshes, **0 errors**. Median times: join 12 ms, submit songs 14 ms,
  live queue 8 ms (p95 21 ms), heart 112 ms (p95 167 ms). On Vercel + Supabase expect
  each number to be higher by the network distance (roughly 20 to 80 ms).
- Production build and type check: clean

### What the load test found and fixed

- **Shared venue Wi-Fi was blocked.** All guests on one Wi-Fi share one internet address;
  the old limit (15 joins and 40 searches per address) would have locked out most of a
  150-person party. Limits are now per phone, with a high cap per address.
- **Every phone rebuilt the whole queue.** Each refresh ran ~6 database queries per phone.
  Now the server builds the queue once per change and shares it with every phone.
- **Song search could hit Apple's free limit** (~20 searches a minute). Searches are now
  cached in the database and shared by everyone.
- **Phones refetched after every single heart.** Refreshes triggered by live updates are now
  spaced at least 1.5 s apart per phone.

## Manual checks before the party

- [ ] Real phones: one iPhone (Safari) and one Android (Chrome) scan the printed poster
- [ ] Search finds real songs on the live site (proves the Apple/iTunes search works from Vercel)
- [ ] `/api/health` shows `"realtime":true` and the green dot appears in the queue header
- [ ] If Apple Music is set up: host creates the live playlist and opens it in Offtrack

## Payments (PR 2, all behind switches)

- `tests/unit/payments-config.test.ts`: prices, fees, plan mapping, boost ranking.
- `tests/integration/payments.test.ts`: uses a fake Stripe (no network, no money).
  Covers: nothing shows while switched off; guests can't pay until the DJ's payouts
  are set up; you can only boost your own song; a boost counts only after Stripe
  confirms it, and only once if Stripe repeats the message; refunds remove the boost;
  tips show in earnings; expired checkouts never count; plan limits (DJ Mode, 50-guest
  cap on Free) apply only when `FEATURE_PLANS=1`; live Stripe keys are refused.
- Full party test (51 checks) passes with every payment switch off, which is how
  Nov 22 will run. `/pricing` returns "not found" while `FEATURE_PLANS` is off.
- Checked with the switches on: pricing page, upgrade buttons and the dashboard's
  "Plan & payouts" panel render with no browser errors.
