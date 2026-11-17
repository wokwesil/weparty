# WeParty player (backup to Offtrack)

Offtrack is still the main way music plays at a WeParty party (see OFFTRACK.md).
The WeParty player is a backup: it plays the crowd's queue straight from the
host/DJ control room, using the host's own Apple Music.

It is **off** unless `FEATURE_HOST_PLAYER=1` is set in Vercel.

## What it needs

1. The Apple Music key is set up (APPLE_MUSIC.md: Apple Developer Program, $99/year).
2. `FEATURE_HOST_PLAYER=1` in Vercel, then redeploy.
3. The person running the player has a **paid Apple Music subscription** and signs in on Apple's own screen.
   Guests don't need Apple Music for this.
4. A **web browser** (Safari or Chrome) on a laptop or iPad connected to the speakers.
   It does not work inside the iPhone/Android app yet, because Apple's sign-in can't open there.

## How it works on the night

- Control room → **▶ Play the queue here** → sign in to Apple Music.
- It plays WeParty's "Now playing" song (or starts the top song if nothing is playing).
- When a song ends, WeParty moves to the next song in crowd order by itself, so Now playing, history and the replay stay right.
- Tapping **Next song**, **Play next** or **Skip** in the control room also changes what the player plays.
- **Pause**, **Skip** and volume are on the player bar. The screen stays awake while it's on (where the browser allows it).

Rules:
- Run the player on **one screen only**. Two screens would both move the queue on.
- Don't run it at the same time as Offtrack. Pick one.
- Songs that aren't in Apple's catalog (for example `[TEST]` songs) can't play; tap Skip.
- Songs play one after another with no DJ crossfades. Offtrack is the option for mixing.

## Music licensing (plain English, not legal advice)

An Apple Music subscription is licensed for personal, non-commercial listening.
That's fine for a house party. For a bar, club or ticketed event, the venue
needs public-performance licenses (ASCAP, BMI, SESAC, GMR in the US), and
Apple's subscriber terms still don't clearly allow commercial playback. The same
applies to Offtrack playing from Apple Music. Check with the venue and a lawyer
before using any streaming service at paid events.

## Testing

`tests/e2e/host-player.mjs` runs the player against a fake Apple MusicKit
(no Apple account needed): it checks the top song starts, the queue moves on when
a song ends (only once), the player follows a manual Next song, and it stops when
the queue is empty. Start the app with `WEPARTY_TEST_CATALOG=1`,
`FEATURE_HOST_PLAYER=1` and any test `APPLE_*` key (for example one made with
`openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt`),
then run `node tests/e2e/host-player.mjs`.

Last result (Nov 17, 2026): 9 of 9 checks passed; main party test 30 of 30.
Not yet tested with a real Apple Music account (waiting on the Apple Developer key).
