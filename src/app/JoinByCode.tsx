"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toLowerCase().replace(/^.*\/e\//, "").replace(/[^a-z0-9]/g, "");
    if (clean) router.push(`/e/${clean}`);
  };
  if (!open) {
    return (
      <div className="flex flex-col items-center gap-3">
        <button className="btn btn-primary w-full py-4 text-lg" onClick={() => setOpen(true)}>
          ENTER PARTY
        </button>
        <p className="text-sm text-muted">Scan the QR code at your party, or tap above to type the party code.</p>
      </div>
    );
  }
  return (
    <form onSubmit={go} className="flex flex-col gap-3">
      <input
        autoFocus
        className="field text-center font-display text-xl tracking-[0.3em] uppercase"
        placeholder="PARTY CODE"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Party code"
      />
      <button className="btn btn-primary w-full py-4 text-lg" disabled={!code.trim()}>
        ENTER PARTY
      </button>
    </form>
  );
}
