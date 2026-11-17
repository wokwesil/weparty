import "server-only";
import { sql } from "./db";
import { env, realtimeConfigured } from "./env";

/**
 * Tells every open phone for this event "something changed, refresh".
 * Uses Supabase Realtime broadcast. The message carries no personal data;
 * phones then fetch the latest queue from the WeParty server, which checks
 * they are a registered guest or the host.
 *
 * If Realtime is not configured, phones fall back to checking every few seconds.
 */
export async function notifyEventChanged(eventId: string, kind = "changed") {
  // New version number = every phone's next refresh gets a freshly built queue.
  try {
    await sql`update events set version = version + 1 where id = ${eventId}`;
  } catch (err) {
    console.warn("[realtime] version bump failed", err);
  }
  if (!realtimeConfigured()) return;
  try {
    await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceKey,
        Authorization: `Bearer ${env.supabaseServiceKey}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `weparty:${eventId}`, event: kind, payload: { at: Date.now() }, private: false }],
      }),
      signal: AbortSignal.timeout(2500),
    });
  } catch (err) {
    console.warn("[realtime] broadcast failed", err);
  }
}
