"use client";
/**
 * Tells the server "someone is on this page" so the owner dashboard (/admin)
 * can show visitors and who is live right now. Sends one "view" per page and a
 * small "still here" ping every 25 seconds while the page is on screen.
 * Uses the same random device id as rate limits; no personal data.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getDeviceId } from "@/lib/device";
import { isNativeApp } from "@/lib/native";

const PING_MS = 25_000;

function send(t: "view" | "ping", path: string, referrer?: string) {
  try {
    const body = JSON.stringify({ v: getDeviceId(), p: path, t, r: referrer, app: isNativeApp() });
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch {
    /* analytics is optional */
  }
}

export function SiteTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    send("view", pathname, first.current ? document.referrer : undefined);
    first.current = false;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") send("ping", pathname);
    }, PING_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") send("ping", pathname);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
