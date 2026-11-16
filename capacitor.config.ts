import type { CapacitorConfig } from "@capacitor/cli";

/**
 * We Party iPhone + Android apps.
 *
 * How it works: the app is a native shell that opens the live We Party website
 * (the same Next.js app on Vercel). The website needs its server for every
 * screen (host sign-in, the live queue, votes), so it can't be packed inside the
 * app as plain files. Loading the live site means:
 *   - sign-in cookies and the database work exactly like on the website;
 *   - every website update reaches the apps instantly, without a store review.
 *
 * Native extras (camera QR scanner, share sheet, haptics, splash screen,
 * status bar) are switched on by src/lib/native.ts when the site runs in the app.
 *
 * To point a test build at another address (e.g. a Vercel preview), run:
 *   WEPARTY_APP_URL=https://your-preview.vercel.app npx cap sync
 */
const appUrl = process.env.WEPARTY_APP_URL || "https://weparty-one.vercel.app";

const config: CapacitorConfig = {
  appId: "com.offtrack.weparty",
  appName: "We Party",
  // Local fallback files bundled in the app: shown only if the website can't load.
  webDir: "capacitor-www",
  appendUserAgent: "WePartyApp",
  backgroundColor: "#07060c",
  server: {
    url: appUrl,
    cleartext: false,
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: "#07060c",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#07060c",
      overlaysWebView: true,
    },
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
