"use client";
import { useState } from "react";
import { WebOnly } from "@/components/WebOnly";
import { apiFetch } from "@/lib/client";

/** Sends the host to Stripe Checkout. Hidden inside the iPhone/Android apps (see docs/PAYMENTS.md). */
export function UpgradeButton({ orgId, plan, events, label }: { orgId: string; plan: string; events?: { id: string; name: string }[]; label: string }) {
  const [eventId, setEventId] = useState(events?.[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/host/billing", { method: "POST", json: { orgId, plan, eventId: eventId || null } });
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <WebOnly fallback={<p className="text-center text-xs text-muted">Upgrade on the We Party website.</p>}>
      <div className="flex flex-col gap-2">
        {events && (
          <select className="field py-2.5 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Event for this pass">
            {events.length === 0 && <option value="">Create an event first</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-primary min-h-12 w-full" onClick={go} disabled={busy || (events !== undefined && !eventId)}>
          {busy ? "Opening checkout…" : label}
        </button>
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </div>
    </WebOnly>
  );
}
