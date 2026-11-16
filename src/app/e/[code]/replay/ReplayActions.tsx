"use client";
import { useEffect, useState } from "react";
import { connectAppleMusic, createLibraryPlaylist, isAppleMusicAvailable } from "@/lib/musickit";

export function ReplayActions({
  code,
  eventName,
  dateLabel,
  shareUrl,
  appleIds,
  replayAppleUrl,
}: {
  code: string;
  eventName: string;
  dateLabel: string;
  shareUrl: string;
  appleIds: string[];
  replayAppleUrl: string | null;
}) {
  const [apple, setApple] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    isAppleMusicAvailable().then(setApple).catch(() => {});
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const text = `The playlist from ${eventName} 🎧 Picked and voted by the crowd on WeParty.`;

  const addToApple = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const mk = await connectAppleMusic();
      const name = `WeParty · ${eventName}`;
      const res = await createLibraryPlaylist(mk, name, `${dateLabel}. Songs played at ${eventName}, picked and voted by the crowd. Made with WeParty.`, appleIds);
      setStatus(`✓ Saved "${name}" to your Apple Music library (${res.added} songs${res.skipped ? `, ${res.skipped} weren't available` : ""}). Open the Music app to listen.`);
    } catch (e) {
      setStatus((e as Error).message || "Apple Music sign-in was cancelled.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: `${eventName} · WeParty Replay`, text, url: shareUrl });
    } catch {
      /* cancelled */
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const smsBody = encodeURIComponent(`${text} ${shareUrl}`);

  return (
    <section className="mt-8 flex flex-col gap-3">
      {replayAppleUrl && (
        <a href={replayAppleUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full py-4">
           Open the playlist on Apple Music
        </a>
      )}
      {apple && appleIds.length > 0 && (
        <button onClick={addToApple} disabled={busy} className={`btn w-full py-4 ${replayAppleUrl ? "btn-ghost" : "btn-primary"}`}>
          {busy ? "Saving…" : " Add to my Apple Music"}
        </button>
      )}
      {status && <p className="rounded-2xl bg-white/5 px-4 py-3 text-center text-sm">{status}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {canShare && (
          <button onClick={share} className="btn btn-ghost px-3 py-3 text-sm">Share…</button>
        )}
        <button onClick={copy} className="btn btn-ghost px-3 py-3 text-sm">{copied ? "Copied!" : "Copy link"}</button>
        <a href={`sms:?&body=${smsBody}`} className="btn btn-ghost px-3 py-3 text-sm">Text it</a>
        <a href={`https://wa.me/?text=${smsBody}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost px-3 py-3 text-sm">WhatsApp</a>
        <a href={`/e/${code}/replay/story`} download={`weparty-${code}-story.png`} className="btn btn-ghost px-3 py-3 text-sm">Instagram Story image</a>
        <a href={`/e/${code}/replay/songs`} className="btn btn-ghost px-3 py-3 text-sm">Song list (.txt)</a>
      </div>
      <p className="text-center text-xs text-muted">
        Instagram: save the Story image, open Instagram, add it to your Story and use the link sticker with this page&apos;s link.
      </p>
    </section>
  );
}
