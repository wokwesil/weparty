# Tonight's vibes ("What's the vibe tonight?")

The host picks up to 6 vibes for a party (Old School Hip Hop, R&B, Afrobeats & Amapiano, Go-Go…).
Guests then pick their songs from inside those vibes.

## Host
Control room → **Tonight's vibes** tab. Tap vibes, then **Save tonight's vibes**.

- **Only take requests in these vibes** (on by default): songs that Apple files under other genres are hidden from
  guests and refused by the server. Songs already in the queue stay. Hosts can still add anything themselves.
  Turn it off and the vibes become suggestions only.
- Pick no vibes = open format, exactly like before.

## Guests
- The welcome screen and the live party screen show "Tonight's vibe" chips.
- On the pick screen there's a tab per vibe. Each opens a **starter crate** of songs to tap with no typing, and the
  search box searches inside that vibe.

## How songs are matched
By the genre Apple Music gives each song (`src/lib/vibes.ts`: each vibe lists genre words it accepts, plus seed
artists for its starter crate). Apple has no reliable "era", so Old School Hip Hop and Hip Hop Right Now accept the
same genre; the difference is the crate. Songs with no genre from Apple are allowed (the DJ can still decline).
Crates are built from a few seed searches (rotated daily) that go through the shared search cache, so Apple is asked rarely.

## Pricing per vibe (saved only, never charged)
WeParty is free for now. With `FEATURE_VIBE_PRICING=1` in Vercel, hosts see a price box next to each picked vibe.
Prices are stored in the event settings (`vibePrices`, cents, max $50) but **guests never see them and nobody is
charged**: there is no payment code behind them. When payments are switched on later (see the business plan), the
checkout would read `vibePrices`. Leave the flag off until then.

## Tests
- `tests/unit/vibes.test.ts`, plus a database test in `tests/integration/djmode.test.ts`.
- End to end: `BASE_URL=http://localhost:3000 node tests/e2e/vibes-flow.mjs` (with `WEPARTY_TEST_CATALOG=1`).
  Screenshots: `tests/e2e/screenshots/vibes-*.png`.
