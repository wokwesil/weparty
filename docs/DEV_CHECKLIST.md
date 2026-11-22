# WeParty development checklist

Last updated: Nov 17, 2026

## Completed

| Phase | Feature | Status |
|---|---|---|
| 1 | Branded dark welcome screen, WEPARTY wordmark, tagline, Powered by Offtrack, ENTER PARTY, animations | ✅ |
| 2 | Multiple events per host, unique code + QR per event (PNG/SVG/printable poster), per-event guests/queue/votes/playlist, no app download | ✅ |
| 3 | Guest profile: photo upload, display name, Instagram handle + link, songs submitted; People tab; tap-through to Instagram | ✅ |
| 4 | PICK YOUR PARTY TRACKS: 1–15 songs (host sets min/max; default up to 15), search with artwork/artist/preview, multi-select tray, submit; Apple Music library/playlists/recently played tab | ✅ (library tab needs Apple key) |
| 5 | Live queue: NOW PLAYING, UP NEXT, LIVE QUEUE, MOST POPULAR, SONG REQUESTS; hearts with optimistic update; real-time sync; animated reordering; one vote per guest per song; undo heart; playing song fixed; host override; ties by submission time | ✅ |
| 6 | Party Shuffle: no duplicates (extra requests counted), hearts, fair rotation, no back-to-back, host locks, configurable settings, playback history | ✅ |
| 7 | Host control room: create/edit events, QR codes, guests + Instagram, monitor requests and votes, remove, skip, reorder, mark played, pause/resume, end, replay, stats, activity log, secure roles | ✅ |
| 8 | YOUR WEPARTY REPLAY: songs actually played in real order, event name/date, artwork, most-requested, most-liked; host creates playlist in own Apple Music; guests save to their own library | ✅ (Apple parts need Apple key) |
| 9 | Unique replay link per event; share sheet, copy link, SMS, WhatsApp, Instagram Story image, link preview image, .txt list | ✅ |
| 10 | Offtrack: researched (no public API); live Apple Music playlist hand-off with append; exports | ✅ (needs testing with real Offtrack) |
| 11 | Event history on dashboard, per-event insights: attendees, songs, picks, hearts, voters, played, skipped, top songs, top contributors, hearts over time, playlist links | ✅ |
| App 1 | Installable website (PWA): manifest, icons, iPhone tags, offline screen, service worker (no private data cached), install tip | ✅ (branch app-setup) |
| App 2 | iPhone + Android apps (Capacitor, loads live site): camera QR scanner, share sheet, haptics, splash, status bar, swipe-back; privacy + support pages; host account deletion and guest "delete my info" | ✅ code ready, needs store accounts → APP_SETUP.md |
| 12 | Organizations (host/venue/DJ/agency/college), team roles (owner/admin/dj), plan + branding + billing fields reserved, multiple simultaneous events, optional host invite code | ✅ architecture (no payments yet, by design) |

## Nov 22 upgrade (PR: join + DJ Mode + reliability)

| Area | Feature | Status |
|---|---|---|
| Faster join | Join on the first screen (Instagram required, name and photo optional); 1 song to join, "Join with N songs"; "Add more songs" all night up to the host's limit; one-tap rejoin on the same phone; "Already at this party" quick picks; drop-off tracking (scanned → profile → picked → joined) + time to join in Insights | ✅ |
| DJ Mode | DJ Booth (one-handed, high contrast, thumb bar); approval mode with swipe approve/decline; lock next 1–5 songs; blocklist (songs + artists incl. features); explicit filter; Crowd Pulse (trending, artists, genres, activity); DJ Spotlight (guest screens + replay); shoutouts | ✅ |
| Reliability | Shared queue snapshot per change (150 phones = 1 DB build); realtime auto-reconnect + polling back-off + offline banner; error/empty/paused/limit states; per-phone rate limits that work on shared venue Wi-Fi; shared search cache; in-app guest reports; Party check page; NOV22_RUNBOOK.md | ✅ |
| Load test | 150 guests in 90 s, 600 hearts, everyone polling every 4 s: 0 errors (see TESTING.md) | ✅ |

## Needs external permissions or accounts

- [ ] **GitHub repo** to store the code (William)
- [ ] **Supabase project** (William, free) → see SETUP.md
- [ ] **Vercel project** (William, free) → see SETUP.md
- [ ] **Apple Developer Program** ($99/yr) for Apple Music API, library browsing and playlist creation → APPLE_MUSIC.md
- [ ] **App stores**: Apple Developer ($99/yr, same account as above) and Google Play Console ($25), plus `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel → APP_SETUP.md
- [ ] **WeParty player (optional backup)**: after the Apple key, set `FEATURE_HOST_PLAYER=1` and test one real song end-to-end on a laptop → HOST_PLAYER.md
- [ ] **Offtrack**: confirm with the real app that a WeParty playlist in Apple Music opens and mixes; ask Offtrack about an API

## Tests passed

- Unit: 16 tests (ranking, blocklist, settings)
- Real Postgres database: 16 integration tests (full party + DJ Mode)
- Browser: 8 simulated phones + host, 51 checks (see TESTING.md)
- Load: 150 guests, 600 hearts, 0 errors
- Production build and TypeScript check clean

## Known limitations

- Song search without the Apple key uses Apple's public iTunes search (rate-limited ~20/min per server; cached, with phone-side fallback).
- Instagram handles are typed, not verified (Meta offers no API for personal accounts).
- Apple's API can't make public playlist links or reorder playlist songs; host shares the public link manually.
- By default WeParty doesn't play audio itself. The DJ/Offtrack plays; the host taps Next song to keep WeParty in sync. Optional backup: the built-in WeParty player (FEATURE_HOST_PLAYER=1, host's own Apple Music, web browser only) → HOST_PLAYER.md.
- Offtrack live-sync behavior must be confirmed on a real device.

## Next up (after Nov 22)

1. Verify Offtrack hand-off with the real app; adjust instructions.
2. Host password reset: built (Forgot password + owner reset link on /admin). Emails need GMAIL_USER + GMAIL_APP_PASSWORD in Vercel (docs/PASSWORD_RESET.md).
3. Venue branding (logo/colors on guest screens) using `organizations.branding`.
4. Paid plans (Stripe) using `organizations.plan` / `billing_customer_id`.
5. Optional: host plays full songs in the browser via MusicKit for parties without a DJ.
