"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { apiFetch } from "@/lib/client";

const money = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

/** Bottom sheet for a Song Boost or a DJ tip. Payment happens on Stripe's own secure page. */
export function PaySheet({
  open,
  onClose,
  code,
  kind,
  amounts,
  itemId,
  title,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  kind: "boost" | "tip";
  amounts: number[];
  itemId?: string;
  title: string;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const pay = async (amount: number) => {
    setBusy(amount);
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/e/${code}/pay`, { method: "POST", json: { kind, amount, itemId } });
      window.location.href = url;
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-label={title}
            className="w-full max-w-md rounded-t-3xl bg-night-2 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              {kind === "boost"
                ? "Boosted songs move up the queue and show a ⚡ label. The DJ still decides what plays."
                : "100% optional. Goes to the DJ (We Party keeps a small fee)."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {amounts.map((a) => (
                <button key={a} className="btn btn-primary min-h-14 text-lg" disabled={busy !== null} onClick={() => pay(a)}>
                  {busy === a ? "…" : money(a)}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted">Secure checkout by Stripe. We never see your card.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
