"use client";
import { useId, useState } from "react";
import { apiFetch } from "@/lib/client";

/** "Follow this DJ/host": email opt-in for their next party. No push notifications. */
export function FollowCard({ code, name, consentText }: { code: string; name: string; consentText: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ unsubscribeUrl: string }>(`/api/e/${code}/follow`, { method: "POST", json: { email, consent } });
      setDone(r.unsubscribeUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="glass rounded-3xl p-5 text-center" role="status">
        <p className="font-display text-lg font-bold">You&apos;re following {name} 🎉</p>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll email you about their next party. Changed your mind?{" "}
          <a href={done} className="text-pink underline">Unsubscribe</a>
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="glass flex flex-col gap-3 rounded-3xl p-5" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="font-display text-lg font-bold">Follow {name}</h2>
      <p className="-mt-2 text-sm text-muted">Hear about their next party first.</p>
      <label htmlFor={`${id}-e`} className="sr-only">Your email</label>
      <input
        id={`${id}-e`}
        className="field"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        maxLength={254}
      />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-pink" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>{consentText}</span>
      </label>
      {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
      <button className="btn btn-primary min-h-12" disabled={busy || !consent || !email}>{busy ? "Saving…" : `Follow ${name}`}</button>
    </form>
  );
}
