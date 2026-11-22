"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { apiFetch } from "@/lib/client";
import { SUPPORT_EMAIL } from "@/lib/site";
import { RecoveryCodeBox } from "../DashboardClient";

type Mode = "email" | "code";

export function ForgotForm({ emailReady }: { emailReady: boolean }) {
  const router = useRouter();
  // Without email switched on, the recovery code is the way hosts reset by themselves.
  const [mode, setMode] = useState<Mode>(emailReady ? "email" : "code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/host/forgot", { method: "POST", json: { email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const useCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ nextCode: string }>("/api/host/recover", { method: "POST", json: { email, code, password } });
      setNextCode(r.nextCode);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const noCodeHelp = SUPPORT_EMAIL ? (
    <>
      Email <a className="text-pink underline" href={`mailto:${SUPPORT_EMAIL}?subject=We%20Party%20password%20reset`}>{SUPPORT_EMAIL}</a> from
      your host email and we&apos;ll send you a reset link.
    </>
  ) : (
    <>Ask the We Party team for a reset link.</>
  );

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Backdrop />
      <Link href="/" className="mb-8 text-center"><Wordmark /></Link>

      {nextCode ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold">Password changed</h1>
          <p className="mt-2 text-center text-sm text-muted">
            You&apos;re signed in. Your old recovery code is used up, so here is your new one:
          </p>
          <RecoveryCodeBox code={nextCode} doneLabel="Go to my dashboard" onDone={() => { router.replace("/host"); router.refresh(); }} />
        </>
      ) : mode === "code" ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-center text-sm text-muted">Use the recovery code you saved from your host dashboard.</p>
          <form onSubmit={useCode} className="mt-8 flex flex-col gap-3">
            <input className="field" type="email" placeholder="Host email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <input className="field font-mono uppercase" placeholder="Recovery code (XXXX-XXXX-XXXX-XXXX)" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-label="Recovery code" />
            <input className="field" type="password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            <input className="field" type="password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            {error && <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
            <button className="btn btn-primary mt-2 py-3.5" disabled={busy}>{busy ? "One sec…" : "Save and sign in"}</button>
          </form>
          <div className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-muted">
            {emailReady ? (
              <>No recovery code? <button type="button" className="text-pink underline" onClick={() => switchTo("email")}>Email me a reset link</button></>
            ) : (
              <>No recovery code? {noCodeHelp}</>
            )}
          </div>
        </>
      ) : sent ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold">Check your email</h1>
          <p className="mt-6 rounded-xl bg-white/5 px-4 py-4 text-center text-sm" role="status">
            If a host account uses <strong>{email}</strong>, we just sent it a link to choose a new password.
            It works for 1 hour. Check your spam folder too.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-center font-display text-2xl font-bold">Forgot your password?</h1>
          <p className="mt-2 text-center text-sm text-muted">Enter your host email and we&apos;ll send you a reset link.</p>
          <form onSubmit={sendLink} className="mt-8 flex flex-col gap-3">
            <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            {error && <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
            <button className="btn btn-primary mt-2 py-3.5" disabled={busy}>{busy ? "One sec…" : "Send reset link"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            Have a recovery code? <button type="button" className="text-pink underline" onClick={() => switchTo("code")}>Use it instead</button>
          </p>
        </>
      )}

      {!nextCode && (
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/host/login" className="text-pink">Back to sign in</Link>
        </p>
      )}
      <PoweredBy className="mt-10 text-center" />
    </main>
  );
}
