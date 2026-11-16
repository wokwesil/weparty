/*
 * We Party offline helper (service worker).
 *
 * What it does:
 *   - Saves the app's own files (scripts, styles, fonts, icons) so the app opens fast.
 *   - Shows a friendly "You're offline" page when there is no connection.
 *
 * What it never does:
 *   - Save or replay API calls, host logins, sessions or live party/vote data.
 *     Those always go straight to the server.
 *
 * Bump VERSION to throw away old saved files after a big change.
 */
const VERSION = "v1";
const SHELL_CACHE = `weparty-shell-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("weparty-") && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Files that never change once published (Next.js gives them unique names) or are pure artwork. */
function isShellAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/manifest.webmanifest"
  );
}

/** Anything live or private. Never cached, never touched. */
function isPrivateOrLive(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/_next/image") ||
    url.search.includes("_rsc=")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Apple Music, Instagram, etc.
  if (isPrivateOrLive(url)) return;
  if (req.headers.get("RSC") || req.headers.get("Next-Router-Prefetch")) return; // in-app page data

  // Pages: always ask the server first (party pages are live). Offline? Show the friendly page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response("You're offline", { status: 503 }))),
    );
    return;
  }

  // App files with unique names never change: use the saved copy, or download and save it.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Icons and the manifest: show the saved copy instantly, refresh it in the background.
  if (isShellAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok && res.type === "basic") cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        if (hit) {
          event.waitUntil(fresh);
          return hit;
        }
        return fresh;
      }),
    );
    return;
  }

  // Everything else (avatars, story images, QR codes...) goes straight to the network.
});
