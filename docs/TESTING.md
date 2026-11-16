# Testing

## 1. Ranking + database tests (fast)

```bash
npm test                                   # ranking engine only
TEST_DATABASE_URL=postgres://... npm test  # plus a full simulated party on a real database
```

The database test runs a whole party: 5 guests join, Instagram handles are
cleaned, duplicate handles are rejected, the 5-to-10 song limits are enforced,
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
(iPhone-sized browsers) open the QR link, upload a profile photo, enter their
Instagram, search and pick 5 songs, and land in the live queue. The test checks
hearts reorder the queue and show up on other phones, the host runs Next song,
override and End event, and the replay, Story image and CSV export all work.
It also checks security: non-guests can't read the queue, guests can't use host
controls, and cross-site requests are blocked. Screenshots go to
`tests/e2e/screenshots/`.

`WEPARTY_TEST_CATALOG=1` swaps Apple search for a built-in list of clearly
labelled `[TEST]` songs so tests don't need the internet. **Never set it in production.**

## Last results (Nov 16, 2026)

- Unit + database: 16 of 16 passed
- Browser: 32 of 32 checks passed with 8 simulated guests
- Production build and type check: clean

## Manual checks before the party

- [ ] Real phones: one iPhone (Safari) and one Android (Chrome) scan the printed poster
- [ ] Search finds real songs on the live site (proves the Apple/iTunes search works from Vercel)
- [ ] `/api/health` shows `"realtime":true` and the green dot appears in the queue header
- [ ] If Apple Music is set up: host creates the live playlist and opens it in Offtrack
