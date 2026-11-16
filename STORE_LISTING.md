# We Party: App Store and Google Play listing

Copy and paste from here when you fill in App Store Connect and the Google Play Console.
Character limits are shown in brackets. Anything in **[square brackets]** is yours to fill in.

---

## Names and links

| Field | Value |
|---|---|
| App name (Apple, 30) / App name (Google, 30) | **We Party** |
| Subtitle (Apple, 30) | **Where We All Control the Vibes** |
| Bundle ID / package name | `com.offtrack.weparty` |
| Primary category | **Music** |
| Secondary category (Apple) | Social Networking |
| Google Play category | Music & Audio |
| Price | Free |
| Privacy policy URL | https://weparty-one.vercel.app/privacy |
| Support URL | https://weparty-one.vercel.app/support |
| Marketing URL (optional) | https://weparty-one.vercel.app |
| Support email | **[your support email]** (also set it as `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel) |
| Copyright (Apple) | **[2026 Your company name]** |

## Short description (Google Play, 80)

> Scan the party QR, pick your songs and heart the crowd's picks. Party together.

(79 characters)

## Promotional text (Apple, 170, can be changed any time without review)

> The party playlist, picked by everyone. Scan the QR, add your songs, heart your favorites and watch the queue move live. Then grab YOUR WEPARTY REPLAY.

## Full description (Apple 4,000 / Google 4,000)

> **We Party: Where We All Control the Vibes.**
>
> We Party turns any party into a playlist everyone helps build. Scan the QR code at the party, pick your favorite songs, and heart the tracks you want to hear next. The crowd decides what plays, and a fairness rule makes sure everyone gets a turn, so no one person can take over the music.
>
> **SCAN**: Open We Party and scan the party's QR code with the built-in scanner. No sign-up or password needed.
>
> **CONNECT**: Add your name, Instagram username and a photo so people at the party can find you.
>
> **SELECT**: Search millions of songs and pick 5 to 10 tracks for the queue.
>
> **VOTE**: Heart other guests' picks. The most-loved songs move up the queue live, on everyone's phone.
>
> **PARTY**: See what's playing now, what's up next, and who picked it.
>
> **REPLAY**: When the night ends, get YOUR WEPARTY REPLAY: the songs that actually played, in order, ready to share.
>
> **For hosts and DJs**
> - Create an event and get a QR code and printable poster in seconds
> - Run the queue from your phone: play, skip, pin or remove songs, pause requests
> - Remove guests if needed, and see party insights afterwards
> - Invite friends with one tap using your phone's share sheet
>
> Powered by Offtrack.

## Keywords (Apple only, 100 characters, comma separated, no spaces)

```
party,playlist,dj,queue,vote,music,song request,jukebox,crowd,host,event,club,social,shuffle,replay
```

(99 characters. Don't repeat "We Party" or "Music"; Apple already uses the name and category.)

## What's new (first version)

> The first We Party app: scan party QR codes with your camera, invite friends with your phone's share sheet, and feel every heart you give.

---

## Age rating answers

### Apple (App Store Connect → App Information → Age Rating)

| Question | Answer |
|---|---|
| Parental controls | No |
| Age assurance | No |
| Unrestricted web access | **No** (the app only opens We Party pages; other links open Safari) |
| User-generated content | **Yes** (guests show a name, Instagram username and photo to others at the same party) |
| Messaging and chat | No |
| Advertising | No |
| Profanity or crude humor | **Infrequent / mild** (song titles and artist names from Apple Music can contain explicit words; hosts can block explicit songs) |
| Mature or suggestive themes | None |
| Horror / fear themes | None |
| Alcohol, tobacco or drug use or references | None |
| Medical or treatment information | None |
| Violence (cartoon, realistic, graphic) | None |
| Sexual content or nudity | None |
| Gambling, simulated gambling, contests | None |
| Loot boxes | No |

Expected result: **13+**. If Apple's questionnaire gives 9+ that's fine too; don't pick a higher age just to be safe, because it hides the app from younger teens' search.

### Google Play (Policy → App content → Content rating, IARC questionnaire)

- Category: **All other app types** (not a game)
- Violence, fear, sexuality, gambling, drugs: **No** to all
- Crude humor / profanity: **Yes, mild** (song titles may contain explicit words)
- "Do users interact or exchange content?": **Yes** (profiles visible to others at the same party)
- "Does the app share the user's current location?": **No**
- "Can users purchase digital goods?": **No**
- "Is the app a web browser or search engine?": **No**

Expected result: **Teen** (ESRB) / **PEGI 12**.

### Target audience (Google Play → App content → Target audience)

Choose **13–15, 16–17 and 18+**. Do **not** tick any age under 13.

---

## App privacy answers

These match what the code and database actually store (see `/privacy` and `supabase/migrations/0001_init.sql`).

### Apple "App Privacy" (nutrition label)

Tracking: **No, we don't track** (no ads, no analytics SDKs, no data brokers).

| Data type | Collected? | Linked to the person? | Used for |
|---|---|---|---|
| Contact info → Name | Yes | Yes | App functionality |
| Contact info → Email address | Yes (hosts only) | Yes | App functionality (sign-in) |
| User content → Photos | Yes (optional profile photo) | Yes | App functionality |
| User content → Other user content | Yes (song picks, Instagram username) | Yes | App functionality |
| Identifiers → User ID | Yes (random party key) | Yes | App functionality |
| Usage data → Product interaction | Yes (hearts, songs played) | Yes | App functionality |
| Search history | Yes (song searches are sent to Apple to find songs, not stored) | No | App functionality |
| Location, health, financial, contacts, browsing history, diagnostics | **No** | | |

### Google Play "Data safety"

- Does your app collect or share user data? **Yes, collects. Does not share** (hosting and database providers are "service providers", which Google doesn't count as sharing).
- Is all data encrypted in transit? **Yes**
- Can users ask for their data to be deleted? **Yes** (in-app: guests "Leave party and delete my info", hosts "Delete my host account"; also by email)
- Data types: **Name**, **Email address** (hosts), **Photos** (optional), **Other in-app messages/content** → choose "Other user-generated content" (song picks, Instagram username), **User IDs**, **App interactions** (hearts). All: collected, not shared, required for app functionality, not optional except Photos.
- Account deletion URL (Google asks for one): https://weparty-one.vercel.app/support

---

## Screenshots to take

Take them on a real party (or the demo party below) with real-looking names. Don't show `[TEST]` songs.
Both stores accept portrait PNG or JPG with no transparency.

| Store | Device size | Pixel size (portrait) | How many |
|---|---|---|---|
| Apple | **iPhone 6.7"** (iPhone 15 Plus / 16 Plus / 14 Pro Max) | **1290 × 2796** | 3 to 10 (required) |
| Apple | **iPhone 6.5"** (iPhone 11 Pro Max / XS Max) | **1242 × 2688** (or 1284 × 2778) | 3 to 10 (only needed if you skip 6.7"/6.9") |
| Apple | iPhone 6.9" (iPhone 16 Pro Max), optional but now preferred | 1320 × 2868 | Apple scales these down for smaller phones |
| Apple | **iPad 13"** (iPad Pro M4 / iPad Air 13") | **2064 × 2752** (or 2048 × 2732 for 12.9") | 3 to 10 (required because the app runs on iPad) |
| Google | **Android phone** | **1080 × 1920** (any 9:16 between 1080 and 3840 px) | 2 to 8 (4+ recommended) |
| Google | Feature graphic | 1024 × 500 | 1, already made: `store/play-feature-graphic-1024x500.png` |
| Google | App icon | 512 × 512 | 1, already made: `store/play-store-icon-512.png` |
| Apple | App icon | 1024 × 1024 | Already inside the Xcode project (also `store/app-store-icon-1024.png`) |

**Screens to capture, in this order** (use the same order for every size):

1. **Home** with the "SCAN PARTY QR" button (in the app)
2. **Join** screen with a name, Instagram and photo filled in
3. **Pick tracks**: search results with a few songs selected
4. **Live queue**: Now Playing plus hearted songs moving up (the money shot)
5. **People** tab: who's at the party
6. **Replay**: YOUR WEPARTY REPLAY playlist
7. **Host control room** on the phone (the queue with Play / Skip buttons)
8. **QR poster** for hosts

Easiest way: run the app in the iOS Simulator (Xcode) on an "iPhone 16 Plus" and "iPad Pro 13-inch", and in the Android Emulator on a "Pixel 7", then press **⌘S** (iOS Simulator) or the camera button (Android Emulator). The images come out at exactly the right size.

---

## Apple review notes (App Review Information)

Before you submit, create the demo below and keep that party **live** (not ended) until the app is approved.

1. On https://weparty-one.vercel.app/host create a host account just for Apple, e.g. **[appreview@yourdomain.com]** with a strong password you only use here.
2. Create an event called **"App Review Demo"** and add 6 to 8 songs from the control room so the queue isn't empty.
3. Note the party code (shown under the QR code) and paste everything into the box below.

**Sign-in required:** Yes. Username **[appreview@yourdomain.com]**, password **[password]**.

**Notes** (paste into "Notes" in App Review Information):

> We Party is a social music queue for parties. Guests scan a QR code at a party, join with a name and Instagram username (no account or password), pick songs and heart other guests' picks; the most-loved songs move up a shared, live queue. Hosts run the party from a control room.
>
> HOW TO TEST AS A GUEST
> 1. Open the app and tap "TYPE PARTY CODE", then enter: [PARTY CODE]
>    (Or tap "SCAN PARTY QR" and scan the attached QR code image. The app uses the camera only for scanning party QR codes and for an optional profile photo.)
> 2. Enter any name and an Instagram-style username (for example "apple.review"). A photo is optional.
> 3. Search for songs and pick at least 5, then tap Add to party.
> 4. In the live queue, tap the heart on any song: the phone gives a small vibration and the song moves up.
> 5. Tap your photo (top right) to see your songs, tap "Invite friends to this party" to open the share sheet, or "Leave party and delete my info" to delete your data.
>
> HOW TO TEST AS A HOST
> 1. On the home screen tap "Hosting a party? Host dashboard" and sign in with the demo account above.
> 2. Open "App Review Demo" → Control room. You can play, skip, pin and remove songs, pause requests, remove guests, and tap "Share invite".
> 3. Account deletion: Host dashboard → "Delete my host account" (please don't delete the demo account during review).
>
> NATIVE FEATURES: camera QR scanner, native share sheet, haptic feedback when hearting songs, native launch screen and status bar, Android back button and iOS swipe-back navigation.
>
> CONTENT MODERATION: Guest content is limited to a name, Instagram username and optional photo, visible only to people at the same party. Hosts can remove any guest instantly; any guest can tap "Report" on another guest, which emails our support team; we act on reports within 24 hours.
>
> Song search uses Apple's music catalog. Apple Music sign-in (to save playlists) is only offered on the website, not in the app.

**Attach:** a picture of the demo party's QR code (download it from the control room: "Download PNG").

**Contact information:** your name, phone and email (Apple only uses these if they have questions).

## Google Play testing instructions (App content → App access)

Choose "All or some functionality is restricted" and add the same demo host login plus:

> Guests don't need an account: open the app, tap "TYPE PARTY CODE" and enter [PARTY CODE]. The host login above opens the host control room from "Hosting a party? Host dashboard".
