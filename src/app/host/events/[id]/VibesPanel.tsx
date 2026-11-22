"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { apiFetch } from "@/lib/client";
import type { PartySettings } from "@/lib/ranking";
import { MAX_VIBE_PRICE_CENTS, MAX_VIBES, VIBES } from "@/lib/vibes";

/** "What's the vibe tonight?": the host picks the lanes guests request from. */
export function VibesPanel({
  eventId,
  settings,
  pricing,
  onSaved,
}: {
  eventId: string;
  settings: PartySettings;
  /** FEATURE_VIBE_PRICING: show price boxes (saved only, never charged while WeParty is free). */
  pricing: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>(settings.vibes);
  const [only, setOnly] = useState(settings.vibesOnly);
  const [prices, setPrices] = useState<Record<string, string>>(() => toDollars(settings.vibePrices));
  const [saving, setSaving] = useState(false);

  // Keep in step if another host device changes the vibes.
  const key = `${settings.vibes.join(",")}|${settings.vibesOnly}|${JSON.stringify(settings.vibePrices)}`;
  useEffect(() => {
    setPicked(settings.vibes);
    setOnly(settings.vibesOnly);
    setPrices(toDollars(settings.vibePrices));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = (id: string) => {
    setPicked((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= MAX_VIBES) {
        toast(`Pick up to ${MAX_VIBES} vibes. Tap one to drop it first.`, "error");
        return p;
      }
      return [...p, id];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const patch: Partial<PartySettings> = { vibes: picked, vibesOnly: only };
      if (pricing) patch.vibePrices = toCents(prices);
      await apiFetch(`/api/host/events/${eventId}/settings`, { method: "PATCH", json: patch });
      toast(picked.length ? "Tonight's vibes saved. Guests see them now." : "Vibes cleared. Guests can request anything.", "success");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="glass flex flex-col gap-4 rounded-3xl p-5">
        <div>
          <h2 className="font-display text-lg font-bold">What&apos;s the vibe tonight?</h2>
          <p className="text-sm text-muted">
            Pick up to {MAX_VIBES}. Guests get a starter crate of songs for each vibe and search inside them. Pick none and guests can request anything.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Vibes">
          {VIBES.map((v) => {
            const on = picked.includes(v.id);
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => toggle(v.id)}
                  aria-pressed={on}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                    on ? "bg-violet/25 ring-2 ring-violet" : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>{v.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{v.label}</span>
                    <span className="block truncate text-xs text-muted">{v.blurb}</span>
                  </span>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${on ? "bg-brand text-white" : "border border-line text-white/60"}`} aria-hidden>
                    {on ? "✓" : "+"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="glass flex flex-col gap-4 rounded-3xl p-5">
          <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Tonight</h2>
          {picked.length === 0 ? (
            <p className="text-sm text-muted">No vibes picked: open format.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {picked.map((id) => {
                const v = VIBES.find((x) => x.id === id)!;
                return (
                  <li key={id} className="flex items-center gap-2">
                    <span aria-hidden>{v.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{v.label}</span>
                    {pricing && (
                      <label className="flex shrink-0 items-center gap-1 text-sm">
                        <span className="text-muted">$</span>
                        <input
                          className="field px-2 py-1 text-right"
                          style={{ width: "5.5rem" }}
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`Price for ${v.label}`}
                          value={prices[id] ?? ""}
                          onChange={(e) => setPrices({ ...prices, [id]: e.target.value.replace(/[^0-9.]/g, "") })}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {pricing && picked.length > 0 && (
            <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
              Prices are saved for later only. WeParty is free right now, so guests don&apos;t see these and nobody is charged.
            </p>
          )}
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="mt-1 h-5 w-5 accent-pink-500" />
            <span>
              <span className="block text-sm font-semibold">Only take requests in these vibes</span>
              <span className="text-xs text-muted">
                Songs Apple files under other genres are hidden from guests and can&apos;t be requested. Songs already in the queue stay. You can still add anything yourself.
              </span>
            </span>
          </label>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save tonight's vibes"}
          </button>
        </div>
        <p className="px-2 text-xs text-muted">
          WeParty matches songs to vibes by the genre Apple Music gives each song. Old school and new hip hop share a genre, so the difference is the starter crate guests browse.
        </p>
      </aside>
    </section>
  );
}

function toDollars(prices: Record<string, number>) {
  return Object.fromEntries(Object.entries(prices).map(([k, c]) => [k, (c / 100).toFixed(2)]));
}

function toCents(prices: Record<string, string>) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(prices)) {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.min(MAX_VIBE_PRICE_CENTS, Math.round(n * 100));
  }
  return out;
}
