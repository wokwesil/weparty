"use client";
/**
 * Small per-phone memory, kept only in this browser:
 *  - a random device id (used for fair rate limits on shared venue Wi-Fi and
 *    for anonymous join drop-off counts; it is not linked to a person),
 *  - the guest's last profile, so joining the next party takes one tap.
 */

const DEVICE_KEY = "wp_device";
const PROFILE_KEY = "wp_profile";

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getDeviceId(): string {
  const s = store();
  let id = s?.getItem(DEVICE_KEY) ?? "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      s?.setItem(DEVICE_KEY, id);
    } catch {
      /* private mode: a fresh id per visit is fine */
    }
  }
  return id;
}

export type SavedProfile = { displayName: string; instagram: string; photo: string | null };

export function getSavedProfile(): SavedProfile | null {
  try {
    const raw = store()?.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedProfile;
    return typeof p.instagram === "string" && p.instagram ? p : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: SavedProfile) {
  try {
    store()?.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked: the next join just isn't one tap */
  }
}

export function forgetProfile() {
  try {
    store()?.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

/** Records one step of the join flow (scanned → profile → picked → joined). Never blocks the guest. */
export function trackStep(code: string, step: "scanned" | "profile" | "picked" | "joined") {
  try {
    const body = JSON.stringify({ device: getDeviceId(), step });
    fetch(`/api/e/${code}/funnel`, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    /* tracking is optional */
  }
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}
