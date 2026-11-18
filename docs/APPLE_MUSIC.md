# Apple Music in WeParty

## What works without any Apple setup

- **Song search** uses Apple's free public iTunes Search API. It returns real
  Apple Music songs with the same IDs, artwork, 30-second previews and
  "Listen on Apple Music" links. Apple limits it to roughly 20 searches a minute
  per server, so WeParty caches results and, if the server gets throttled,
  phones search Apple directly.
- **Replay page and exports**: every played song links to Apple Music.

## What needs the Apple Developer account

| Feature | Who signs in | Where it writes |
|---|---|---|
| Better catalog search (Apple Music API) | nobody | nothing |
| Guests pick from their own library, playlists, recently played | that guest | nothing (read-only) |
| Host creates the REPLAY playlist | host | host's library |
| Host creates/updates the live Offtrack playlist | host | host's library |
| Guest taps "Add to my Apple Music" on the replay page | that guest | that guest's own library |
| **WeParty player**: control room plays the crowd's queue (HOST_PLAYER.md) | host/DJ | nothing (plays only) |

Each person always signs in on Apple's own screen. WeParty never sees passwords.
Host and guest permissions are separate: a guest's sign-in can only touch that
guest's library, and the host's sign-in only the host's.

## Setup (about 20 minutes plus Apple's enrollment wait)

1. Join the **Apple Developer Program** ($99/year) at developer.apple.com.
   Enrollment as an individual is usually quick; as a company it can take days.
2. In **Certificates, Identifiers & Profiles → Identifiers**, click **+**,
   choose **Media IDs**, describe it as "WeParty", enable **MusicKit**, register.
3. In **Keys**, click **+**, name it "WeParty MusicKit", tick **Media Services
   (MusicKit…)**, configure it with the Media ID from step 2, and download the
   `.p8` file. **You can only download it once.** Note the **Key ID**.
4. Your **Team ID** is shown at the top right of the developer site (Membership).
5. In Vercel add:
   - `APPLE_TEAM_ID`
   - `APPLE_KEY_ID`
   - `APPLE_PRIVATE_KEY` (open the `.p8` in a text editor and paste all of it;
     WeParty also accepts it with `\n` instead of line breaks, or without the BEGIN/END lines)
   - `APPLE_MUSIC_STOREFRONT` = `us` (or your country code)
6. Redeploy. `/api/health` should now say `"appleMusic":true` and
   `"appleMusicKeyWorks":true` (WeParty asks Apple for one song to prove the key works;
   if not, `"appleMusicProblem"` says what to fix). Guests see a "My Apple Music" tab
   when picking songs, and the control room shows **▶ Play the queue here**.

## Limits (from Apple's official API)

- Library playlists created through the API are private to that person's
  library. The API **cannot** create a public share link. The host shares the
  replay publicly by opening it in the Music app → Share Playlist → Copy link,
  and pasting that link in the control room. Guests then get an
  "Open on Apple Music" button.
- The API can **add** songs to a playlist but **cannot reorder or remove**
  them. That's why the live Offtrack playlist only appends.
- Library browsing and saving playlists need an active Apple Music subscription
  on that person's account.
- Songs a person uploaded themselves (not in Apple's catalog) can't be shared,
  so they're hidden from the picker.
