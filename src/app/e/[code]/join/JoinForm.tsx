"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { DjSpotlight } from "@/components/DjSpotlight";
import { ApiError, apiFetch, resizeImage } from "@/lib/client";
import { blobToDataUrl, dataUrlToBlob, forgetProfile, getSavedProfile, saveProfile, trackStep, type SavedProfile } from "@/lib/device";
import type { EventPublic } from "@/lib/types";

/**
 * One-screen join: Instagram (required), display name and photo (optional).
 * Returning guests on the same phone get a one-tap "Join as @you".
 */
export function JoinForm({
  code,
  eventName,
  subtitle,
  dj,
  submissionsOpen,
}: {
  code: string;
  eventName: string;
  subtitle: string | null;
  dj: EventPublic["dj"];
  submissionsOpen: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [useSaved, setUseSaved] = useState(false);
  const [name, setName] = useState("");
  const [ig, setIg] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    trackStep(code, "scanned");
    const p = getSavedProfile();
    if (p) {
      setSaved(p);
      setUseSaved(true);
    }
    // (No prefetch of the pick page here: before joining it would cache a redirect back to this screen.)
  }, [code]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const blob = await resizeImage(file);
      setPhoto(blob);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const join = async (profile: { displayName: string; instagram: string; photo: Blob | null; photoDataUrl?: string | null }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ guest: { instagram: string; displayName: string } }>(`/api/e/${code}/join`, {
        method: "POST",
        json: { displayName: profile.displayName, instagram: profile.instagram },
      });
      trackStep(code, "profile");
      if (profile.photo) {
        await fetch(`/api/e/${code}/me/avatar`, { method: "POST", body: profile.photo, headers: { "Content-Type": "image/jpeg" } }).catch(() => {});
      }
      // Remember this profile on this phone so the next party is one tap.
      const photoDataUrl = profile.photoDataUrl ?? (profile.photo ? await blobToDataUrl(profile.photo).catch(() => null) : null);
      saveProfile({ displayName: res.guest.displayName, instagram: res.guest.instagram, photo: photoDataUrl });
      router.replace(`/e/${code}/pick`);
    } catch (err) {
      const e = err as ApiError;
      setError(
        e.code === "instagram_taken" && useSaved
          ? `${e.message} Or join with a different handle below.`
          : e.message,
      );
      if (e.code === "instagram_taken") setUseSaved(false);
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    join({ displayName: name, instagram: ig, photo });
  };

  const joinSaved = async () => {
    if (!saved) return;
    const blob = saved.photo ? await dataUrlToBlob(saved.photo).catch(() => null) : null;
    join({ displayName: saved.displayName, instagram: saved.instagram, photo: blob, photoDataUrl: saved.photo });
  };

  const igClean = ig.trim().replace(/^@/, "");

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <Backdrop />
      <header className="flex items-center justify-between gap-3">
        <Wordmark size="sm" />
        <PoweredBy className="text-[10px]" />
      </header>

      <section className="mt-6">
        <p className="text-[11px] font-semibold tracking-[0.35em] text-muted uppercase">You&apos;re invited to</p>
        <h1 className="mt-1 font-display text-3xl font-black leading-tight">{eventName}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        {dj && (
          <div className="mt-3">
            <DjSpotlight dj={dj} compact />
          </div>
        )}
      </section>

      {!submissionsOpen && (
        <p className="mt-4 rounded-2xl bg-amber-500/15 px-4 py-2.5 text-sm text-amber-100">
          Song requests are paused right now. You can still join and heart songs.
        </p>
      )}

      {useSaved && saved ? (
        <section className="mt-6 flex flex-1 flex-col">
          <div className="glass flex items-center gap-4 rounded-3xl p-4">
            {saved.photo ? (
              <img src={saved.photo} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-violet text-2xl font-bold">
                {(saved.displayName || saved.instagram).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Welcome back</p>
              <p className="truncate text-lg font-bold">{saved.displayName}</p>
              <p className="truncate text-sm font-semibold text-pink">@{saved.instagram}</p>
            </div>
          </div>
          {error && <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
          <div className="mt-auto flex flex-col gap-3 pt-6">
            <button className="btn btn-primary w-full py-4 text-lg" onClick={joinSaved} disabled={busy}>
              {busy ? "Joining…" : `JOIN AS @${saved.instagram.toUpperCase()}`}
            </button>
            <button
              className="py-2 text-sm text-muted underline-offset-4 hover:text-white hover:underline"
              onClick={() => {
                setUseSaved(false);
                setError(null);
              }}
            >
              Not you? Use a different profile
            </button>
          </div>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-1 flex-col gap-4">
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-line bg-night-2 text-muted hover:border-violet"
              aria-label="Add a profile photo (optional)"
            >
              {preview ? <img src={preview} alt="Your profile photo" className="h-full w-full object-cover" /> : <span className="text-xl" aria-hidden>📷</span>}
            </button>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold">Instagram username</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                <input
                  className="field pl-9"
                  value={ig}
                  onChange={(e) => setIg(e.target.value)}
                  placeholder="yourhandle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  spellCheck={false}
                  enterKeyHint="go"
                  required
                  maxLength={60}
                  name="instagram"
                />
              </div>
            </label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              Display name <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should people call you?"
              maxLength={60}
              name="displayName"
              enterKeyHint="go"
            />
          </label>

          {error && <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}

          <div className="mt-auto pt-2">
            <button className="btn btn-primary w-full py-4 text-lg" disabled={busy || !igClean}>
              {busy ? "Joining…" : "NEXT: PICK A SONG"}
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              One song is all it takes. Photo is optional and you can add it later. Your name, photo and handle are shown to
              guests at this party. We never log into your Instagram.
            </p>
          </div>
          {saved && (
            <button type="button" className="text-xs text-muted underline" onClick={() => { forgetProfile(); setSaved(null); }}>
              Forget my saved profile on this phone
            </button>
          )}
        </form>
      )}
    </main>
  );
}
