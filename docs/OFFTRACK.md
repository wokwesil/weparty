# Offtrack integration

## What Offtrack is (from its App Store and Google Play listings, Nov 2026)

Offtrack ("the AI DJ app", by Mixonset Inc.) automatically mixes songs with
transitions. It plays from **Apple Music** (partial catalog), Spotify Premium,
TIDAL, SoundCloud and local files, and lets you mix your playlists from those
services and adjust the queue order inside the app.

| Question | Answer |
|---|---|
| Supports Apple Music playlists? | Yes, it mixes playlists from your connected Apple Music |
| Playlist imports from other apps? | Only via the streaming service's library (no file import documented) |
| Public API for other apps? | **None published** |
| External queue management? | **No.** Queue is managed inside Offtrack |
| DJ playback controls for other apps? | **No** |

We found no developer documentation, API, or partner program. WeParty does not
pretend otherwise. If William has a contact at Offtrack, ask them:
"Do you offer an API or URL scheme to load a playlist or queue songs?"

## The workflow WeParty uses

```
Guest picks → crowd hearts → WeParty ranked queue
   → "WeParty LIVE" playlist in the host's Apple Music library
   → host opens that playlist in Offtrack and starts the mix
```

In the control room → **Apple Music & Offtrack**:

1. **Create live playlist** puts the next 15 songs (in WeParty order) into a
   new playlist in the host's Apple Music library.
2. In Offtrack, open that playlist and start mixing.
3. During the night tap **Add next songs** to append the newest top songs.
4. When Offtrack moves on, tap **Next song** in the Live queue tab so WeParty's
   Now Playing, history and replay stay accurate.

Known limits: Apple's API can't reorder or remove playlist songs, so WeParty
only appends. Offtrack may need the playlist reopened to see new songs. **Test
this with the real Offtrack app before Nov 22.**

## Fallback without Apple Music access

Control room → QR, details & export → **Upcoming queue (.txt)** gives an
"Artist - Title" list. The DJ can search those in Offtrack, or import the list
into Apple Music with a playlist-transfer tool.
