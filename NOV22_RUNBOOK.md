# Nov 22 runbook: running We Party on the night

Print this or keep it open on a second phone. Plain English, no tech needed.

## Before the night (do these by Friday Nov 21)

- [ ] **Database update is applied.** In Supabase: SQL Editor → New query → paste
      all of `supabase/migrations/0002_join_djmode_reliability.sql` → Run. You
      should see "Success". (Do this *before* the new version goes live. Running it twice is harmless.)
- [ ] **Site is healthy.** Open `https://weparty-one.vercel.app/api/health`. You want
      `"ok":true`, `"database":true` and ideally `"realtime":true`.
- [ ] **Event created** at `/host` with the right name, venue and time.
- [ ] **Rules set** (control room → Party shuffle settings): songs to join (1 is fastest)
      and max songs per guest (10 is a good default). Clean party? Turn on
      **DJ Mode → Filter explicit tracks**.
- [ ] **DJ Mode set up** (control room → DJ Mode): turn it on, add the DJ's name,
      Instagram and photo. Decide with the DJ: **Approve requests first** on or off,
      and how many songs to **lock** (2 or 3 works well).
- [ ] **DJ signed in.** If the DJ runs the booth from their own phone, add them
      under Accounts & team on `/host` (role: DJ). They need a host account first.
- [ ] **Posters printed** (QR, details & export → Printable poster). Print only after
      the final web address is set. Tape one at the entrance, bar and DJ booth.
- [ ] **Party check is green.** Control room → ✅ Party check. Scan the QR with
      your phone, join with one song, then tap Re-check.
- [ ] **Blocklist** any songs or artists the DJ never wants (DJ settings → Blocklist).

## When doors open (10 minutes before)

1. Open the event on your phone. It says **DJ Booth** at the top when DJ Mode is on.
2. Open **✅ Party check** once more. Everything should say ✅ (⚠️ items are optional).
3. Make sure requests are **open** (the bottom bar shows ⏸ PAUSE, not ▶ OPEN).
4. Add 2 or 3 warm-up songs yourself so the queue isn't empty.

## During the party

- **The DJ plays a song from the top:** tap the big green **NEXT SONG** button.
  This keeps Now Playing and the replay accurate.
- **Approve or decline requests** (if approval is on): swipe right to approve, left to
  decline, or tap ✓ / ✕. **Approve all** clears the list.
- **Keep a song from moving:** DJ settings → Lock the next songs (1 to 5).
- **Play something now / next:** tap ⋯ on the song → Play now or Play next.
- **Never want a song or artist:** ⋯ → Block song / Block artist. Their songs leave the queue.
- **Talk to the crowd:** tap 📣 and pick a message or write your own. It shows on every
  guest's screen for 15 minutes.
- **Crowd Pulse** tab: trending requests, most-hearted artists and genres. Suggestions only.

## How to pause requests

Tap **⏸ PAUSE** in the DJ Booth's bottom bar (or **Pause requests** at the top).
Guests can still heart songs. Tap **▶ OPEN** to take requests again.

## How to remove a guest

Control room → **Guests** tab. Reported guests show at the top with ⚠ and the reason.
Tap **Remove / reset**, then tap again to confirm. Their profile, hearts and song picks
are removed. If they just lost their phone or typed the wrong handle, this lets them
join again fresh.

## If the Wi-Fi drops

- **Guests:** nothing to do. Their screen keeps showing the queue, says
  "Reconnecting…", and catches up by itself when the signal returns. Hearts or picks
  that failed show an error so they can tap again.
- **DJ Booth:** switch your phone to mobile data (turn Wi-Fi off) and keep going.
  The header shows "reconnecting…" until it's back.
- **The music never stops because of We Party.** We Party only manages the queue.
  If everything is down, the DJ keeps playing and you tap NEXT SONG to catch up later.
- **Venue Wi-Fi is overloaded?** Tell guests to switch to mobile data. We Party is
  light: joining uses about as much data as one Instagram photo.

## If something looks wrong

| Problem | What to do |
|---|---|
| "We couldn't find that party" | The QR is for another event. Reprint from this event's QR tab. |
| A guest says "already at this party" | They joined before on another phone. Guests tab → Remove / reset, then they join again. |
| A guest can't add songs | Requests are paused, they hit the song limit, or the song is blocked/declined. The app tells them which. |
| Queue isn't updating on phones | Pull down to refresh. Check `/api/health`. Phones re-check every 4 seconds even without live updates. |
| Wrong song is Now Playing | Tap ⋯ on the right song → Play now. |

## At the end

1. Tap **End event** (tap twice to confirm). Every guest's screen shows the replay link.
2. Share the replay (`/e/<code>/replay`) on your Instagram Story with the Story image.
3. Look at **Insights**: how many people scanned, joined, and how long joining took.
