# WeParty development checklist

Last updated: Nov 16, 2026

## Completed

| Phase | Feature | Status |
|---|---|---|
| 1 | Branded dark welcome screen, WEPARTY wordmark, tagline, Powered by Offtrack, ENTER PARTY, animations | ✅ |
| 2 | Multiple events per host, unique code + QR per event (PNG/SVG/printable poster), per-event guests/queue/votes/playlist, no app download | ✅ |
| 3 | Guest profile: photo upload, display name, Instagram handle + link, songs submitted; People tab; tap-through to Instagram | ✅ |
| 4 | PICK YOUR PARTY TRACKS: 5–10 songs, search with artwork/artist/preview, multi-select tray, submit; Apple Music library/playlists/recently played tab | ✅ (library tab needs Apple key) |
| 5 | Live queue: NOW PLAYING, UP NEXT, LIVE QUEUE, MOST POPULAR, SONG REQUESTS; hearts with optimistic update; real-time sync; animated reordering; one vote per guest per song; undo heart; playing song fixed; host override; ties by submission time | ✅ |
| 6 | Party Shuffle: no duplicates (extra requests counted), hearts, fair rotation, no back-to-back, host locks, configurable settings, playback history | ✅ |
| 7 | Host control room: create/edit events, QR codes, guests + Instagram, monitor requests and votes, remove, skip, reorder, mark played, pause/resume, end, replay, stats, activity log, secure roles | ✅ |
| 8 | YOUR WEPARTY REPLAY: songs actually played in real order, event name/date, artwork, most-requested, most-liked; host creates playlist in own Apple Music; guests save to their own library | ✅ (Apple parts need Apple key) |
| 9 | Unique replay link per event; share sheet, copy link, SMS, WhatsApp, Instagram Story image, link preview image, .txt list | ✅ |
| 10 | Offtrack: researched (no public API); live Apple Music playlist hand-off with append; exports | ✅ (needs testing with real Offtrack) |
| 11 | Event history on dashboard, per-event insights: attendees, songs, picks, hearts, voters, played, skipped, top songs, top contributors, hearts over time, playlist links | ✅ |
| 12 | Organizations (host/venue/DJ/agency/college), team roles (owner/admin/dj), plan + branding + billing fields reserved, multiple simultaneous events, optional host invite code | ✅ architecture (no payments yet, by design) |

## Needs external permissions or accounts

- [ ] **GitHub repo** to store the code (William)
- [ ] **Supabase project** (William, free) → see SETUP.md
- [ ] **Vercel project** (William, free) → see SETUP.md
- [ ] **Apple Developer Program** ($99/yr) for Apple Music API, library browsing and playlist creation → APPLE_MUSIC.md
- [ ] **Offtrack**: confirm with the real app that a WeParty playlist in Apple Music opens and mixes; ask Offtrack about an API

## Tests passed

- Ranking engine: 11 unit tests
- Full party on a real Postgres database: 5 integration tests
- Browser: 8 simulated phones + host, 32 checks (see TESTING.md)
- Production build and TypeScript check clean

## Known limitations

- Song search without the Apple key uses Apple's public iTunes search (rate-limited ~20/min per server; cached, with phone-side fallback).
- Instagram handles are typed, not verified (Meta offers no API for personal accounts).
- Apple's API can't make public playlist links or reorder playlist songs; host shares the public link manually.
- WeParty doesn't play audio itself. The DJ/Offtrack plays; the host taps Next song to keep WeParty in sync.
- Offtrack live-sync behavior must be confirmed on a real device.

## Next up (after Nov 22)

1. Verify Offtrack hand-off with the real app; adjust instructions.
2. Host password reset by email (needs an email provider such as Resend or Supabase Auth).
3. Venue branding (logo/colors on guest screens) using `organizations.branding`.
4. Paid plans (Stripe) using `organizations.plan` / `billing_customer_id`.
5. Optional: host plays full songs in the browser via MusicKit for parties without a DJ.
