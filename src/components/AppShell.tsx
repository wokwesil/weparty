"use client";
/**
 * Runs once on every page:
 *  - website: registers the offline helper (service worker) and shows a small
 *    "Install We Party" tip on pages where it can't get in the way;
 *  - iPhone/Android app: sets the status bar, hides the launch screen,
 *    handles the Android back button and links that open the app.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativeApp, nativePlatform } from "@/lib/native";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "wp_install_dismissed_at";
const IOS_TIP_KEY = "wp_ios_install_tip_shown";
const DISMISS_DAYS = 14;

/**
 * Pages where the install tip may appear. The guest join flow (welcome, join,
 * pick tracks) and the live party screen are left alone so nothing covers
 * buttons a guest needs.
 */
function installTipAllowed(path: string) {
  return path === "/" || path === "/host" || /^\/e\/[^/]+\/replay\/?$/.test(path);
}

function store(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
  return null;
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  // Only Safari can "Add to Home Screen" reliably; skip in-app browsers (Instagram, etc.).
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV/.test(ua);
}

export function AppShell() {
  const [mode, setMode] = useState<"web" | "native" | null>(null);
  useEffect(() => setMode(isNativeApp() ? "native" : "web"), []);
  if (mode === "native") return <NativeSetup />;
  if (mode === "web") return <WebSetup />;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Website                                                                    */
/* -------------------------------------------------------------------------- */

function WebSetup() {
  const path = usePathname() ?? "/";
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Offline helper. Only in production builds, so local development never serves stale files.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production" && !isNativeApp()) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    if (isStandalone()) return; // already installed

    const recentlyDismissed = Number(store(DISMISS_KEY) ?? 0) > Date.now() - DISMISS_DAYS * 864e5;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // we show our own small banner instead of Chrome's
      if (!recentlyDismissed) setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isIosSafari() && !store(IOS_TIP_KEY)) setIosTip(true);

    // Wait a moment so the tip never pops up over the first thing people tap.
    const t = setTimeout(() => setHidden(false), 2500);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !installTipAllowed(path)) return null;

  if (installEvent) {
    return (
      <InstallBanner
        text="Install We Party for one-tap access at every party."
        action="Install"
        onAction={async () => {
          await installEvent.prompt();
          await installEvent.userChoice.catch(() => null);
          setInstallEvent(null);
        }}
        onClose={() => {
          store(DISMISS_KEY, String(Date.now()));
          setInstallEvent(null);
        }}
      />
    );
  }

  if (iosTip) {
    return (
      <InstallBanner
        text={
          <>
            Install We Party: tap <ShareIcon /> <b>Share</b> → <b>Add to Home Screen</b>.
          </>
        }
        onClose={() => {
          store(IOS_TIP_KEY, "1");
          setIosTip(false);
        }}
      />
    );
  }
  return null;
}

function InstallBanner({
  text,
  action,
  onAction,
  onClose,
}: {
  text: React.ReactNode;
  action?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Install We Party"
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="glass pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-3 py-2.5 shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl" />
        <p className="flex-1 text-sm leading-snug">{text}</p>
        {action && onAction && (
          <button className="btn btn-primary shrink-0 px-4 py-2 text-sm" onClick={onAction}>
            {action}
          </button>
        )}
        <button onClick={onClose} aria-label="Dismiss" className="shrink-0 px-1.5 text-xl leading-none text-muted hover:text-white">
          ×
        </button>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg aria-label="Share" viewBox="0 0 24 24" className="inline h-4 w-4 -translate-y-px" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* iPhone / Android app                                                       */
/* -------------------------------------------------------------------------- */

function NativeSetup() {
  const router = useRouter();

  useEffect(() => {
    document.documentElement.dataset.nativeApp = nativePlatform();
    // The app never uses the website's offline helper (it can stop native features working on Android).
    navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});

    const cleanups: (() => void)[] = [];
    (async () => {
      const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
      ]);
      // Light status bar text on our dark design. The page draws under it and pads for the notch.
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});

      // Android back button: go back a page, or close the app from the home screen.
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      });
      // Party links (e.g. a QR scanned with the phone camera) that open the app.
      const open = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          if (u.pathname.startsWith("/")) router.push(u.pathname + u.search);
        } catch {
          /* ignore bad links */
        }
      });
      cleanups.push(() => back.remove(), () => open.remove());

      // Replay files (story image, song list) open in an in-app browser sheet with a
      // Done button, where they can be saved or shared, instead of replacing the app screen.
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement | null)?.closest?.("a");
        if (!a?.href) return;
        const url = new URL(a.href, window.location.href);
        if (url.origin === window.location.origin && /^\/e\/[^/]+\/replay\/(story|songs)\/?$/.test(url.pathname)) {
          e.preventDefault();
          import("@capacitor/browser").then(({ Browser }) => Browser.open({ url: url.href })).catch(() => {});
        }
      };
      document.addEventListener("click", onClick, true);
      cleanups.push(() => document.removeEventListener("click", onClick, true));
    })().catch(() => {});
    return () => cleanups.forEach((c) => c());
  }, [router]);

  return null;
}
