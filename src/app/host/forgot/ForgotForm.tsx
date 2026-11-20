"use client";
import Link from "next/link";
import { useState } from "react";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { apiFetch } from "@/lib/client";
import { SUPPORT_EMAIL } from "@/lib/site";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "emailed" | "no-email">(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ emailReady?: boolean }>("/api/host/forgot", { method: "POST", json: { email } });
      setSent(res?.emailReady === false ? "no-email" : "emailed");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Backdrop />
      <Link href="/" className="mb-8 text-center"><Wordmark /></Link>
      <h1 className="text-center font-display text-2xl font-bold">Forgot your password?</h1>
      {sent === "no-email" ? (
        <p className="mt-6 rounded-xl bg-white/5 px-4 py-4 text-center text-sm" role="status">
          Reset emails aren&apos;t switched on yet, so we couldn&apos;t email you.{" "}
          {SUPPORT_EMAIL ? (
            <>Email <a className="text-pink underline" href={`mailto:${SUPPORT_EMAIL}?subject=We%20Party%20password%20reset`}>{SUPPORT_EMAIL}</a> from <strong>{email}</strong> and we&apos;ll send you a reset link.</>
          ) : (
            <>Ask the We Party team for a reset link for <strong>{email}</strong>.</>
          )}
        </p>
      ) : sent ? (
        <p className="mt-6 rounded-xl bg-white/5 px-4 py-4 text-center text-sm" role="status">
          If a host account uses <strong>{email}</strong>, we just sent it a link to choose a new password.
          It works for 1 hour. Check your spam folder too.
        </p>
      ) : (
        <>
          <p className="mt-2 text-center text-sm text-muted">Enter your host email and we&apos;ll send you a reset link.</p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
            <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            {error && <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
            <button className="btn btn-primary mt-2 py-3.5" disabled={busy}>{busy ? "One sec…" : "Send reset link"}</button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/host/login" className="text-pink">Back to sign in</Link>
      </p>
      <PoweredBy className="mt-10 text-center" />
    </main>
  );
}
