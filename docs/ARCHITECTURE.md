# Architecture

## The big picture

```
 Guest phones (browser)          Host phone/laptop (browser)
        │   QR → /e/<code>               │  /host
        ▼                                ▼
 ┌──────────────────────────────────────────────────┐
 │  WeParty web app (Next.js on Vercel)              │
 │  • Pages (React, Tailwind, Motion animations)     │
 │  • Server endpoints /api/* check who you are      │
 │  • Party Shuffle engine (src/lib/ranking.ts)      │
 └───────┬───────────────────────┬──────────────────┘
         │ SQL                   │ "queue changed" ping
         ▼                       ▼
   Supabase Postgres      Supabase Realtime (broadcast)
                                 │
                                 └──► every phone refreshes

 Apple Music API / iTunes Search ◄── song search (server)
 MusicKit JS (in the browser)    ◄── personal library + playlist creation
```

## Key decisions (and why)

- **All database access goes through the WeParty server.** Every table has Row
  Level Security switched on with no public policies, so Supabase's public key
  can't read or write anything. This keeps guests' data safe even if someone
  inspects the website code.
- **Guests have no passwords.** Joining creates a random secret stored in a
  secure, http-only cookie on that phone. The database only keeps a hash of it.
- **Hosts use WeParty's own email + password sign-in** (scrypt-hashed passwords,
  signed session cookie). We chose this over Supabase Auth so the whole sign-in
  works and is tested without extra Supabase email setup before launch. It can
  be swapped for Supabase Auth later without changing the database design.
- **Live updates** use Supabase Realtime *broadcast*: after any change the
  server sends a tiny "changed" message (no personal data), and phones fetch the
  fresh queue. If Realtime is off, phones re-check every 4 seconds. Refetches are
  spread over ~1 second so 200 phones don't hit the server at once.
- **Profile photos** are resized on the phone (400×400 JPEG, ~30 KB) and stored
  in Postgres, so there's no separate file storage to configure.
- **Business-ready accounts**: events belong to an *organization* (a host,
  venue, DJ, agency or college). Organizations have members with roles
  (owner/admin/dj), a `plan`, `branding` and a reserved `billing_customer_id`.
  Paid plans can be added later without restructuring.

## Database

| Table | Purpose |
|---|---|
| `organizations` | A host / venue / DJ / agency account. Plan + branding for later monetization |
| `hosts` | People who run events (email, hashed password) |
| `org_members` | Who belongs to which organization, with role owner/admin/dj |
| `events` | One party: code for the QR link, status, submissions open/paused, shuffle settings, replay link |
| `guests` | One person at one event: display name, Instagram, hashed browser key |
| `guest_avatars` | Profile photo bytes |
| `queue_items` | One row per unique song per event, with status queued/playing/played/skipped/removed, host pin, play order |
| `song_requests` | Which guests picked each song (duplicates become extra requests) |
| `votes` | Hearts. Primary key (song, guest) makes duplicate votes impossible |
| `event_log` | Audit trail of host actions and key moments |
| `rate_limits` | Abuse protection for sign-ups, search, hearts |

Important constraints: unique `(event_id, apple_song_id)` (no duplicate songs),
unique `(event_id, instagram_username)`, and at most one `playing` song per event.

## The Party Shuffle algorithm

1. **Host-locked songs first.** When the host moves a song, that song and the
   ones above it are locked in the host's order.
2. **Everyone else gets a score:**
   `score = hearts × heartWeight + (requests − 1) × requestWeight − fairness × turn`
   where a guest's *turn* = songs of theirs already played + how many of their
   own songs rank above this one. So each guest's best song competes with
   everyone else's best song, which stops one person from dominating.
3. **Higher score plays first; ties go to whoever submitted first.**
4. **No back-to-back:** if the next song is from the same person as the one
   before, the next song from someone else (within 3 places) goes first.
5. The **playing song** is not in the ranked list, so it never moves.

Defaults: heartWeight 1, requestWeight 1, fairness 2, no back-to-back on.
With fairness 2, a song needs 2 more hearts than another guest's song to jump
a fairness "round". Hosts can change all of this live in the control room.

## Third-party restrictions summary

- **Apple Music**: needs a paid Apple Developer membership for the API and
  MusicKit. Playlists made via the API are private to the person's library; no
  public link via API; no reorder/remove of playlist songs. See APPLE_MUSIC.md.
- **Instagram**: no API for personal profiles since Dec 2024; no automated DMs
  or Story posting from the web. Manual username + photo upload. See INSTAGRAM.md.
- **Offtrack**: no public API. Hand-off through an Apple Music playlist. See OFFTRACK.md.
- **iTunes Search API** (fallback search): free, ~20 requests/minute/IP.
