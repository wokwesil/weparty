"use client";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "./client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let realtimeClient: ReturnType<typeof createClient> | null = null;
function getRealtime() {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  if (!realtimeClient) {
    realtimeClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return realtimeClient;
}

/** "live" = instant updates; "polling" = checking every few seconds; "offline" = no connection right now. */
export type LiveStatus = "live" | "polling" | "offline";

/** Never refetch more often than this because of "something changed" pings (protects the server at 150+ phones). */
const MIN_PING_GAP_MS = 1500;

/**
 * Keeps data for a live event fresh on every phone.
 * - Listens for Supabase Realtime "something changed" pings and refetches.
 * - If Realtime drops, it quietly reconnects (with back-off) and meanwhile
 *   re-checks every 4 seconds, so guests never notice.
 * - If the phone loses its connection, it keeps showing the last queue,
 *   retries with back-off, and refreshes the moment the phone is back online.
 */
export function useLiveData<T>(url: string, eventId: string | null, opts: { onUnauthorized?: () => void } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [offline, setOffline] = useState(false);
  const inflight = useRef(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetch = useRef(0);
  const failures = useRef(0);
  const onUnauth = useRef(opts.onUnauthorized);
  onUnauth.current = opts.onUnauthorized;

  const refresh = useCallback(async () => {
    if (inflight.current) {
      pending.current = true;
      return;
    }
    inflight.current = true;
    lastFetch.current = Date.now();
    try {
      const d = await apiFetch<T>(url);
      setData(d);
      setError(null);
      setOffline(false);
      failures.current = 0;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauth.current?.();
      failures.current++;
      // Network gone (status 0) or the server is struggling: show a calm "reconnecting" note.
      if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) setOffline(true);
      setError((e as Error).message);
    } finally {
      inflight.current = false;
      if (pending.current) {
        pending.current = false;
        setTimeout(refresh, 250);
      }
    }
  }, [url]);

  /** Refetch soon, with a little random delay so 200 phones don't all ask at the same instant. */
  const nudge = useCallback(() => {
    if (timer.current) return;
    const since = Date.now() - lastFetch.current;
    const wait = Math.max(0, MIN_PING_GAP_MS - since) + 150 + Math.random() * 700;
    timer.current = setTimeout(() => {
      timer.current = null;
      refresh();
    }, wait);
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription with automatic reconnect.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!eventId) return;
    const client = getRealtime();
    if (!client) return;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const channel: RealtimeChannel = client
      .channel(`weparty:${eventId}`)
      .on("broadcast", { event: "*" }, () => nudge())
      .subscribe((status) => {
        if (closed) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          refresh(); // catch up on anything missed while disconnected
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
          if (!retry) {
            const delay = Math.min(30_000, 2000 * 2 ** Math.min(attempt, 4)) + Math.random() * 1000;
            retry = setTimeout(() => setAttempt((a) => a + 1), delay);
          }
        }
      });
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, nudge, attempt]);

  // Polling safety net + catch-up when the phone wakes up or comes back online.
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      const base = connected ? 20_000 : 4000;
      // When the connection is failing, back off (4s, 8s, up to 15s) so phones don't hammer a struggling server.
      const ms = failures.current > 0 ? Math.min(15_000, base * 2 ** Math.min(failures.current - 1, 2)) : base;
      t = setTimeout(() => {
        if (stop) return;
        if (document.visibilityState === "visible") refresh();
        loop();
      }, ms);
    };
    loop();
    const onVis = () => document.visibilityState === "visible" && refresh();
    const onOnline = () => {
      setOffline(false);
      refresh();
      setAttempt((a) => a + 1); // resubscribe to live updates
    };
    const onOffline = () => setOffline(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stop = true;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [connected, refresh]);

  const status: LiveStatus = offline ? "offline" : connected ? "live" : "polling";
  return { data, setData, error, refresh, connected, status };
}
