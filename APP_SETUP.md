# We Party apps: setup guide (plain English)

We Party now comes in three forms:

1. **The website**, which people can also *install* to their home screen (no app store needed).
2. **An iPhone app** for the Apple App Store.
3. **An Android app** for Google Play.

All three show the same live We Party website. The phone apps are a native "shell" around it that adds phone-only extras: a camera QR scanner, the phone's share sheet, a little vibration when you heart a song, and a proper launch screen. **Any change you deploy to Vercel shows up in the apps straight away**, with no new store review. You only rebuild the apps when the native parts change (icons, permissions, new phone features).

> Why the apps load the live site instead of carrying a copy inside them: We Party needs its server for every screen (host sign-in, the live queue, votes, the database). A copy inside the app couldn't do any of that. Loading the live site keeps sign-in and the database working exactly like on the web, and lets you fix things instantly.

---

## Contents

1. [Things only you can do (checklist)](#1-things-only-you-can-do)
2. [Install the website as an app (iPhone and Android)](#2-install-the-website-as-an-app)
3. [Sign up for the developer accounts](#3-sign-up-for-the-developer-accounts)
4. [Build and run the iPhone app (Mac + Xcode)](#4-build-and-run-the-iphone-app)
5. [Build and run the Android app (Android Studio)](#5-build-and-run-the-android-app)
6. [Upload to the App Store and submit for review](#6-upload-to-the-app-store-and-submit)
7. [Upload to Google Play and submit for review](#7-upload-to-google-play-and-submit)
8. [Pushing updates later](#8-pushing-updates-later)
9. [Optional next steps (party links open the app, push notifications)](#9-optional-next-steps)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Things only you can do

- [ ] **Merge the pull request** so the install feature, privacy page and support page go live on https://weparty-one.vercel.app.
- [ ] **Add a support email in Vercel.** Vercel → your project → Settings → Environment Variables → add `NEXT_PUBLIC_SUPPORT_EMAIL` = the address people should write to (for example `support@yourdomain.com`). Then redeploy (Deployments → ⋯ → Redeploy). Both stores reject apps without a working support contact, and this also turns on the guest "Report" button.
- [ ] **Decide the names** (see "Decisions" at the bottom of the pull request): app name "We Party", bundle ID `com.offtrack.weparty`, and which company/person is the seller.
- [ ] **Apple Developer Program**: $99 per year.
- [ ] **Google Play Console**: $25 once.
- [ ] **Create the App Review demo** host account and party (see `STORE_LISTING.md` → "Apple review notes").
- [ ] **Take the screenshots** listed in `STORE_LISTING.md`.
- [ ] **Keep the Android signing key safe** (step 5.4). If you lose it you can't update your app.

Never paste passwords, `DATABASE_URL`, `SESSION_SECRET` or other secret keys into the code or this repository. They stay in Vercel → Settings → Environment Variables.

---

## 2. Install the website as an app

Anyone can do this today, no store needed.

### iPhone (must use Safari)

1. Open **https://weparty-one.vercel.app** in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up, at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. We Party now has its own icon and opens full screen, without the Safari bars.

We Party shows this tip once on the home page for iPhone visitors.

### Android (Chrome)

1. Open **https://weparty-one.vercel.app** in **Chrome**.
2. Tap **Install** on the small "Install We Party" banner at the bottom, or open Chrome's **⋮** menu → **Install app** (or **Add to Home screen**).
3. Tap **Install**.

The install banner never appears on the guest join, song-picking or live party screens, so it can't get in the way of scanning in.

**Offline:** if someone opens We Party without internet, they see a friendly "You're offline" screen with a Try again button. Live party data, votes and sign-ins are never saved on the phone; they always come fresh from the server.

---

## 3. Sign up for the developer accounts

### Apple Developer Program ($99/year)

1. On an iPhone or Mac, make sure your Apple Account has **two-factor authentication** on (Settings → your name → Sign-In & Security).
2. Go to **https://developer.apple.com/programs/enroll/** and tap **Start your enrollment**. The easiest way is the **Apple Developer app** on iPhone (free from the App Store) → Account → Enroll now.
3. Choose who is enrolling:
   - **Individual**: quick (often same day). Your **personal name** is shown as the seller on the App Store.
   - **Organization** (a company, e.g. Offtrack): the **company name** is shown as the seller. You need a free **D-U-N-S number** for the company (Apple links to the request form; it can take 1 to 2 weeks), a company website and the legal right to sign for the company.
4. Pay the $99. Approval usually takes 1 to 2 days.

### Google Play Console ($25 once)

1. Go to **https://play.google.com/console/signup** and sign in with the Google account you want to own the app (a shared business account is better than a personal one).
2. Choose **Organization** (needs a D-U-N-S number) or **Personal**.
3. Pay the $25 and verify your identity (ID photo, and for organizations the D-U-N-S details). This takes a few days.
4. **Important for personal accounts:** Google requires new personal accounts to run a **closed test with at least 12 testers for 14 days in a row** before the app can go public. Organization accounts skip this. Plan for it: ask 12+ friends to install the test version from step 7.

---

## 4. Build and run the iPhone app

You need a **Mac**. (No Mac? You can rent one online, e.g. MacinCloud, or ask a friend with a Mac; the steps are the same.)

### 4.1 One-time setup

1. Install **Xcode** from the Mac App Store (free, large download; the newest version).
2. Open Xcode once, accept the license, and let it install the iOS components it offers.
3. Install **Node.js 22** (LTS) from **https://nodejs.org**.
4. Install **Git** if it isn't there: open the **Terminal** app and type `git --version`; if asked, click Install.
5. In Terminal, download the code and install it:

   ```bash
   git clone https://github.com/wokwesil/weparty.git
   cd weparty
   npm install
   ```

### 4.2 Open and run the app

```bash
npm run app:ios
```

This copies the latest settings into the iPhone project and opens it in Xcode. Then:

1. In the left column click **App** (the blue icon at the top). Select the **App** target, then the **Signing & Capabilities** tab.
2. Tick **Automatically manage signing** and pick your **Team** (your Apple Developer account; sign in via Xcode → Settings → Accounts if it isn't listed).
3. Check **Bundle Identifier** says `com.offtrack.weparty`.
4. At the top of the window, pick a simulator such as **iPhone 16 Plus**, then press the **▶ Play** button. The We Party app opens in the simulator.
5. To try it on your own iPhone: plug it in with a cable, pick it at the top instead of the simulator, press **▶**. The first time, on the iPhone go to Settings → General → VPN & Device Management and trust your developer profile, and turn on Settings → Privacy & Security → **Developer Mode**.

The camera QR scanner only works on a real iPhone (simulators have no camera).

### 4.3 Make the build you upload

1. In Xcode, at the top, choose **Any iOS Device (arm64)** instead of a simulator.
2. Set the version: App target → **General** → **Version** `1.0.0` and **Build** `1`. (Every upload needs a bigger Build number than the last one.)
3. Menu **Product → Archive**. Wait a few minutes; the **Organizer** window opens.
4. Select the new archive → **Distribute App** → **App Store Connect** → **Upload** → keep the defaults → **Upload**.
5. After 10 to 30 minutes the build appears in App Store Connect (you get an email).

---

## 5. Build and run the Android app

Works on Mac, Windows or Linux.

### 5.1 One-time setup

1. Install **Android Studio** (free) from **https://developer.android.com/studio**. Open it and click through the setup wizard with the defaults (it downloads the Android SDK).
2. Install **Node.js 22** and **Git**, and download the code with `git clone` / `npm install` exactly as in step 4.1.

### 5.2 Open and run the app

```bash
npm run app:android
```

This opens the Android project in Android Studio. The first time, wait for the bottom bar to finish "Gradle sync" (a few minutes).

1. Open **Tools → Device Manager** and create a virtual phone (for example **Pixel 7**) if there isn't one.
2. Pick the phone at the top and press the green **▶ Run** button. We Party opens in the emulator.
3. To use your own Android phone: on the phone, Settings → About phone → tap **Build number** 7 times to unlock Developer options, then Settings → System → Developer options → turn on **USB debugging**. Plug it in, allow the prompt, pick it at the top, press **▶**.

### 5.3 Set the version

Open `android/app/build.gradle` and find:

```
versionCode 1
versionName "1.0"
```

`versionCode` must go up by at least 1 for every upload (1, 2, 3...). `versionName` is what people see (1.0, 1.1...).

### 5.4 Make the signed bundle you upload

1. Menu **Build → Generate Signed App Bundle or APK** → **Android App Bundle** → Next.
2. Under **Key store path** click **Create new...**. Save the file somewhere safe **outside** the weparty folder (e.g. `Documents/weparty-upload-key.jks`), choose strong passwords, Alias `upload`, Validity 25 years, fill in your name/company. OK.
3. **Back up that .jks file and both passwords** in a password manager. Never put it in GitHub. If you lose it, Google can reset it, but it's slow.
4. Next → choose **release** → **Create**. Android Studio shows a link to the finished file, `android/app/release/app-release.aab`.

---

## 6. Upload to the App Store and submit

1. Go to **https://appstoreconnect.apple.com** → **Apps** → **+** → **New App**.
   - Platforms: **iOS**. Name: **We Party**. Primary language: English (U.S.). Bundle ID: **com.offtrack.weparty** (appears after your first Xcode upload or after Xcode registers it). SKU: `weparty-ios`. Access: Full.
2. Fill in the pages on the left using `STORE_LISTING.md`:
   - **App Information**: subtitle, category Music (secondary: Social Networking), **Age Rating** answers, privacy policy URL.
   - **Pricing and Availability**: Free, all countries (or the ones you want).
   - **App Privacy**: answer with the table in `STORE_LISTING.md` → "App privacy answers" → Publish.
   - **iOS App → 1.0 Prepare for Submission**: screenshots (6.7"/6.9" iPhone and 13" iPad), promotional text, description, keywords, support URL, marketing URL, version 1.0.0, copyright.
   - **Build**: click **+** and choose the build you uploaded in 4.3. When asked about encryption, the answer is already set in the app ("uses only standard encryption"), so there's nothing to do.
   - **App Review Information**: the demo host email and password, the review notes and the demo party QR image from `STORE_LISTING.md`, and your contact details.
   - **Version Release**: "Manually release this version" lets you choose the launch moment.
3. Click **Add for Review** → **Submit to App Review**.
4. Review usually takes 1 to 3 days. If Apple asks a question or rejects it, you get an email; reply in App Store Connect → **App Review** messages. Common fixes are easy (a missing screenshot, a demo login that doesn't work), so **keep the demo party live** during review.

**Before submitting, test on TestFlight (recommended):** App Store Connect → your app → **TestFlight** → add yourself as an internal tester → install the **TestFlight** app on your iPhone → install We Party and try a full party.

---

## 7. Upload to Google Play and submit

1. Go to **https://play.google.com/console** → **Create app**. Name **We Party**, language English, **App**, **Free**, accept the declarations.
2. Left menu **Test and release → Testing → Internal testing** → **Create new release**. Google offers **Play App Signing**: accept (Google keeps the final key; your .jks is the "upload key"). Upload `app-release.aab`, add release notes, **Save → Review release → Start rollout**. Add your own email as a tester and install from the link to check it works.
3. **Grow → Store presence → Main store listing**: name, short and full description from `STORE_LISTING.md`, app icon `store/play-store-icon-512.png`, feature graphic `store/play-feature-graphic-1024x500.png`, phone screenshots.
4. **Policy → App content**, answer each card (answers in `STORE_LISTING.md`):
   - Privacy policy: `https://weparty-one.vercel.app/privacy`
   - Ads: **No ads**
   - App access: **Some functionality is restricted** → add the demo host login and party code
   - Content rating: fill in the IARC questionnaire
   - Target audience: 13+ only
   - Data safety: use the "Data safety" answers
   - Government apps, financial features, health: **No**
5. **Closed testing** (required for new personal accounts): **Test and release → Testing → Closed testing** → create a track, upload the same .aab, add at least 12 testers' Gmail addresses (or a Google Group), and have them install it and keep it for 14 days.
6. When ready: **Test and release → Production → Create new release** → pick the .aab → **Review release → Start rollout to Production** (for personal accounts the "Apply for production" button unlocks after the closed test).
7. First review usually takes a few days, sometimes up to a week.

---

## 8. Pushing updates later

**Most updates need no store work at all.** Anything in the website (screens, wording, features, fixes) goes live in the website, the installed home-screen app and both store apps as soon as Vercel deploys it.

You only need a **new store build** when you change the native side, for example:
- new app icon or launch screen,
- a new phone feature/plugin (e.g. turning on push notifications),
- changed permissions text,
- a Capacitor upgrade.

Then:

1. Pull the latest code and install: `git pull` then `npm install`.
2. If you changed the artwork: `npm run app:icons` then `npm run app:assets`.
3. **iPhone**: `npm run app:ios` → raise **Build** (and Version if you like) in Xcode → Product → Archive → Distribute → Upload → in App Store Connect click **+** next to iOS App to create the new version, choose the new build, fill in "What's New", submit.
4. **Android**: `npm run app:android` → raise `versionCode` (and `versionName`) in `android/app/build.gradle` → Build → Generate Signed App Bundle (use the **same** .jks) → Play Console → Production → Create new release → upload → roll out.

**Website-only change to the offline helper:** if you ever change `public/sw.js`, bump `VERSION` at the top so phones throw away old saved files.

---

## 9. Optional next steps

### Make party QR links open the app (when it's installed)

Right now scanning a party QR with the phone's normal camera opens the website (which works fine). To make those links open the We Party app instead:

- **iPhone (Universal Links)**: needs your Apple **Team ID** (developer.apple.com → Membership). Then we add an `apple-app-site-association` file to the website and the "Associated Domains" setting in Xcode. Ask Claude to do it and give it the Team ID.
- **Android (App Links)**: the app is already set up to accept `https://weparty-one.vercel.app/e/...` links. It needs a `/.well-known/assetlinks.json` file on the website with your app's **SHA-256 certificate fingerprint** (Play Console → Test and release → Setup → **App signing** → copy "SHA-256 certificate fingerprint"). Ask Claude to add it with that value.

If you move to your own domain (e.g. weparty.app), change it in `capacitor.config.ts`, `android/app/src/main/AndroidManifest.xml` and Vercel, and rebuild the apps.

### Push notifications (ready, but switched off)

Nothing is turned on. When you approve it, the plan is:

1. **Decide what to notify** (ideas: "your song is up next", "the replay is ready", host announcements). Apple rejects apps that send ads or spam via push.
2. **Accounts/keys you create** (Claude can't create these for you):
   - Apple: developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → create an **APNs** key (.p8). Note the Key ID and Team ID.
   - Google: a free **Firebase** project → add an Android app with package `com.offtrack.weparty` → download `google-services.json` (goes into `android/app/`) → upload the Apple .p8 key in Firebase too, so one service sends to both.
   - Firebase service-account key → stored as a Vercel environment variable, never in code.
3. **Code changes** (Claude does these): install `@capacitor/push-notifications`, add the "Push Notifications" capability in Xcode, ask permission only after a guest joins a party (never on first launch), save each phone's token in a new `device_tokens` table, send from the server when the event happens, and add a "stop notifications" switch.
4. Update `/privacy` and the App Privacy / Data safety answers (device token = "Device ID"), then submit new store builds.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Xcode: "Signing for App requires a development team" | Signing & Capabilities → pick your Team (step 4.2). |
| Xcode: "No such module" / package errors | File → Packages → **Reset Package Caches**, then Product → Clean Build Folder, then ▶ again. Run `npm install` and `npx cap sync ios` first. |
| Android Studio: Gradle sync failed | File → **Sync Project with Gradle Files**. Make sure Android Studio is up to date and you ran `npm install` and `npx cap sync android`. |
| App opens to "You're offline" | The phone has no internet, or the website is down. Check https://weparty-one.vercel.app/api/health in a browser. |
| Camera scanner says nothing / closes | Allow camera access: iPhone Settings → We Party → Camera; Android Settings → Apps → We Party → Permissions → Camera. Simulators/emulators have no real camera. |
| Want to test a Vercel preview in the app | `WEPARTY_APP_URL=https://your-preview-url.vercel.app npx cap sync` then run again. Run `npx cap sync` without it to go back to the live site. **Always** build store uploads without it. |
| Apple Music "connect" isn't shown in the app | Expected: Apple's sign-in window can't open inside apps. Hosts make Apple Music playlists from the control room in Safari/Chrome. |
| Install banner doesn't show on Android | Chrome only offers it after a short visit, and not if it was dismissed in the last 14 days or the app is already installed. Use ⋮ → Install app. |

### What's where (for developers)

| Path | What it is |
|---|---|
| `capacitor.config.ts` | App ID, name, the live URL the apps load, splash/status bar settings |
| `ios/`, `android/` | The native projects (open with Xcode / Android Studio) |
| `capacitor-www/` | Tiny fallback pages bundled in the app (offline screen) |
| `src/lib/native.ts` | QR scanner, share sheet, haptics helpers (fall back to web features in browsers) |
| `src/components/AppShell.tsx` | Install banner, offline helper registration, native status bar/splash/back button |
| `src/app/manifest.ts`, `public/sw.js`, `public/offline.html` | Installable website: manifest, offline helper, offline page |
| `scripts/make-app-icons.mjs` → `assets/`, `public/icons/`, `store/` | All icons, splash screens and store graphics from one artwork (`npm run app:icons`, then `npm run app:assets`) |
| `src/app/privacy`, `src/app/support` | Privacy policy and support pages |
| `STORE_LISTING.md` | Everything to paste into the stores |
