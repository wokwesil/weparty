"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Backdrop, Wordmark } from "@/components/Brand";
import { apiFetch, resizeImage } from "@/lib/client";

export function JoinForm({ code, eventName }: { code: string; eventName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ig, setIg] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/e/${code}/join`, { method: "POST", json: { displayName: name, instagram: ig } });
      if (photo) {
        await fetch(`/api/e/${code}/me/avatar`, { method: "POST", body: photo, headers: { "Content-Type": "image/jpeg" } }).catch(() => {});
      }
      router.replace(`/e/${code}/pick`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const igClean = ig.trim().replace(/^@/, "");

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Backdrop />
      <header className="flex items-center justify-between">
        <Wordmark size="sm" />
        <span className="truncate pl-4 text-sm text-muted">{eventName}</span>
      </header>
      <h1 className="mt-10 font-display text-3xl font-black leading-tight">Who&apos;s in the room?</h1>
      <p className="mt-2 text-muted">Your profile shows next to the songs you pick, so people can find you.</p>

      <form onSubmit={submit} className="mt-8 flex flex-1 flex-col gap-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-line bg-night-2 text-muted hover:border-violet"
            aria-label="Add a profile photo"
          >
            {preview ? (
              <img src={preview} alt="Your profile photo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs leading-tight">
                <span className="block text-2xl">＋</span>Photo
              </span>
            )}
          </button>
          <div className="text-sm text-muted">
            Add a profile photo (optional).<br />
            We never log into your Instagram.
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </div>

        <label className="flex flex-col gap-2">
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
              required
              maxLength={60}
              name="instagram"
            />
          </div>
          {igClean && (
            <a href={`https://instagram.com/${encodeURIComponent(igClean)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-pink">
              Check it&apos;s you: instagram.com/{igClean} ↗
            </a>
          )}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Display name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should people call you?" maxLength={60} name="displayName" />
        </label>

        {error && <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}

        <div className="mt-auto pt-4">
          <button className="btn btn-primary w-full py-4 text-lg" disabled={busy || !igClean}>
            {busy ? "Joining…" : "NEXT: PICK YOUR TRACKS"}
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            Your name, photo and Instagram handle are shown to other guests at this party.
          </p>
        </div>
      </form>
    </main>
  );
}
