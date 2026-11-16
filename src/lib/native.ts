"use client";
/**
 * Native app helpers.
 *
 * The iPhone and Android apps (built with Capacitor, see capacitor.config.ts)
 * open the live We Party website inside a native shell. When the site runs
 * inside that shell, these helpers use real phone features: the camera QR
 * scanner, the system share sheet and vibration (haptics). In a normal
 * browser they quietly fall back to web features, so the website keeps
 * working exactly as before.
 *
 * Plugins are loaded on demand, so none of this code is downloaded by
 * guests using the website.
 */

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True inside the We Party iPhone/Android app. */
export function isNativeApp() {
  return Boolean(cap()?.isNativePlatform?.());
}

export function nativePlatform(): "ios" | "android" | "web" {
  const p = cap()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

/** A light tap feeling, used when someone hearts a song. Does nothing on the website. */
export async function hapticTap(strong = false) {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch {
    /* haptics are a nice-to-have */
  }
}

/**
 * Opens the share sheet (native in the app, the browser's share menu on phones).
 * Returns "shared", "copied" (link copied instead) or "cancelled".
 */
export async function shareLink(opts: { title: string; text?: string; url: string }): Promise<"shared" | "copied" | "cancelled"> {
  if (isNativeApp()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(opts);
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(opts.url);
    return "copied";
  } catch {
    return "cancelled";
  }
}

/**
 * Turns whatever a QR code contains into a party code.
 * Accepts full links like https://weparty-one.vercel.app/e/abc123 or a bare code.
 */
export function partyCodeFromScan(text: string): string | null {
  const raw = text.trim();
  const fromLink = raw.match(/\/e\/([a-z0-9]{4,16})(?:[/?#]|$)/i);
  if (fromLink) return fromLink[1].toLowerCase();
  if (/^[a-z0-9]{4,16}$/i.test(raw)) return raw.toLowerCase();
  return null;
}

/** Opens the native camera scanner (app only). Returns the scanned text, or null if cancelled. */
export async function scanQrCode(): Promise<string | null> {
  if (!isNativeApp()) return null;
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import("@capacitor/barcode-scanner");
  try {
    const res = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: "Point your camera at the party QR code",
      cancelButtonAccessibilityLabel: "Cancel",
    });
    return res?.ScanResult || null;
  } catch {
    return null; // cancelled, or camera permission denied
  }
}
