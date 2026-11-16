"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { apiFetch } from "@/lib/client";

export function AuthForm({ mode, needsInvite }: { mode: "login" | "signup"; needsInvite?: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", displayName: "", orgName: "", orgKind: "host", inviteCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/host/${mode}`, { method: "POST", json: f });
      router.replace("/host");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Backdrop />
      <Link href="/" className="mb-8 text-center"><Wordmark /></Link>
      <h1 className="text-center font-display text-2xl font-bold">{mode === "login" ? "Host sign in" : "Create a host account"}</h1>
      <p className="mt-2 text-center text-sm text-muted">Run parties, print QR codes, and control the queue.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        {mode === "signup" && (
          <>
            <input className="field" placeholder="Your name" value={f.displayName} onChange={set("displayName")} required autoComplete="name" />
            <input className="field" placeholder="Brand, venue or DJ name (optional)" value={f.orgName} onChange={set("orgName")} />
            <select className="field" value={f.orgKind} onChange={set("orgKind")} aria-label="Account type">
              <option value="host">I host parties</option>
              <option value="dj">I&apos;m a DJ</option>
              <option value="venue">Venue / nightclub / bar</option>
              <option value="agency">Event planner / agency</option>
              <option value="college">College / organization</option>
            </select>
          </>
        )}
        <input className="field" type="email" placeholder="Email" value={f.email} onChange={set("email")} required autoComplete="email" />
        <input
          className="field"
          type="password"
          placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
          value={f.password}
          onChange={set("password")}
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {mode === "signup" && needsInvite && (
          <input className="field" placeholder="Host invite code" value={f.inviteCode} onChange={set("inviteCode")} required />
        )}
        {error && <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
        <button className="btn btn-primary mt-2 py-3.5" disabled={busy}>
          {busy ? "One sec…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? (
          <>New host? <Link href="/host/signup" className="text-pink">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/host/login" className="text-pink">Sign in</Link></>
        )}
      </p>
      <PoweredBy className="mt-10 text-center" />
    </main>
  );
}
