"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativeApp, partyCodeFromScan, scanQrCode } from "@/lib/native";

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [native, setNative] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  useEffect(() => setNative(isNativeApp()), []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toLowerCase().replace(/^.*\/e\//, "").replace(/[^a-z0-9]/g, "");
    if (clean) router.push(`/e/${clean}`);
  };

  // In the iPhone/Android app: open the camera and jump straight into the party.
  const scan = async () => {
    setScanError(null);
    const text = await scanQrCode();
    if (!text) return;
    const found = partyCodeFromScan(text);
    if (found) router.push(`/e/${found}`);
    else setScanError("That QR code isn't a We Party code. Try again, or type the party code.");
  };

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-3">
        {native && (
          <button className="btn btn-primary w-full py-4 text-lg" onClick={scan}>
            SCAN PARTY QR
          </button>
        )}
        <button className={`btn w-full py-4 text-lg ${native ? "btn-ghost" : "btn-primary"}`} onClick={() => setOpen(true)}>
          {native ? "TYPE PARTY CODE" : "ENTER PARTY"}
        </button>
        {scanError && <p className="text-sm text-amber-200">{scanError}</p>}
        <p className="text-sm text-muted">
          {native ? "Point your camera at the QR code at your party." : "Scan the QR code at your party, or tap above to type the party code."}
        </p>
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
