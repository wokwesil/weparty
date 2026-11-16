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

/**
 * Keeps data for a live event fresh on every phone.
 * - Listens for Supabase Realtime "something changed" pings and refetches.
 * - Also re-checks every few seconds (slower when Realtime is connected),
 *   so the party keeps working even if Realtime is down.
 */
export function useLiveData<T>(url: string, eventId: string | null, opts: { onUnauthorized?: () => void } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const inflight = useRef(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUnauth = useRef(opts.onUnauthorized);
  onUnauth.current = opts.onUnauthorized;

  const refresh = useCallback(async () => {
    if (inflight.current) {
      pending.current = true;
      return;
    }
    inflight.current = true;
    try {
      const d = await apiFetch<T>(url);
      setData(d);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauth.current?.();
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
    timer.current = setTimeout(() => {
      timer.current = null;
      refresh();
    }, 150 + Math.random() * 700);
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!eventId) return;
    const client = getRealtime();
    let channel: RealtimeChannel | null = null;
    if (client) {
      channel = client
        .channel(`weparty:${eventId}`)
        .on("broadcast", { event: "*" }, () => nudge())
        .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    }
    return () => {
      if (channel && client) client.removeChannel(channel);
    };
  }, [eventId, nudge]);

  useEffect(() => {
    const ms = connected ? 20000 : 4000;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, ms);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [connected, refresh]);

  return { data, setData, error, refresh, connected };
}
