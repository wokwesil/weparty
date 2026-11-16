# WEPARTY

**Where We All Control the Vibes.** Scan. Connect. Select. Vote. Party. Replay.
Powered by Offtrack.

WeParty is a web app for parties. Guests scan a QR code, add their Instagram,
pick 5 to 10 songs, and heart each other's picks. The crowd's hearts plus a
fairness rule decide the order. The host runs everything from a control room on
their phone or laptop. When the night ends, everyone gets **YOUR WEPARTY REPLAY**:
a shareable playlist page of the songs that actually played.

No app download for guests. Works on iPhone and Android browsers.

## What's in here

| Path | What it is |
|---|---|
| `src/app/` | Every screen and server endpoint (Next.js App Router) |
| `src/app/e/[code]/` | Guest experience: welcome, join, pick tracks, live party, replay |
| `src/app/host/` | Host dashboard: events, control room, QR poster, insights |
| `src/lib/ranking.ts` | The Party Shuffle engine (how the queue is ordered) |
| `src/lib/services/` | Business logic: hosts, events, guests, queue |
| `src/lib/musickit.ts` | Apple Music sign-in, library browsing, playlist creation |
| `supabase/migrations/` | Database tables, indexes and security rules |
| `tests/` | Unit, database and full browser tests |
| `docs/` | Setup, deployment, integrations, architecture, checklist |

## Docs

- [Launch setup in plain English (start here)](docs/SETUP.md)
- [Development checklist and status](docs/DEV_CHECKLIST.md)
- [Architecture, database and ranking algorithm](docs/ARCHITECTURE.md)
- [Apple Music](docs/APPLE_MUSIC.md) · [Instagram](docs/INSTAGRAM.md) · [Offtrack](docs/OFFTRACK.md)
- [Testing](docs/TESTING.md)
- [Running the Nov 22 party](docs/PARTY_NIGHT.md)

## Quick start for developers

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL and SESSION_SECRET at least
npm run db:migrate
npm run dev                    # http://localhost:3000
```

Tech: Next.js 15, TypeScript, Tailwind CSS 4, Supabase (Postgres + Realtime), Apple MusicKit, Vercel.
