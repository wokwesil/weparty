"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Backdrop, PoweredBy, Wordmark } from "@/components/Brand";
import { apiFetch } from "@/lib/client";

export function ResetForm() {
  const router = useRouter();
  // The token is after "#" in the link so it never reaches server logs.
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.location.hash.slice(1));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/host/reset", { method: "POST", json: { token, password } });
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
      <h1 className="text-center font-display text-2xl font-bold">Choose a new password</h1>
      {token === "" ? (
        <p className="mt-6 text-center text-sm text-muted">
          This page needs the link from your reset email.{" "}
          <Link href="/host/forgot" className="text-pink">Get a new link</Link>
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
          <input className="field" type="password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          <input className="field" type="password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          {error && (
            <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200" role="alert">
              {error}{" "}
              {error.includes("expired") && <Link href="/host/forgot" className="underline">Get a new link</Link>}
            </p>
          )}
          <button className="btn btn-primary mt-2 py-3.5" disabled={busy || !token}>{busy ? "One sec…" : "Save and sign in"}</button>
        </form>
      )}
      <PoweredBy className="mt-10 text-center" />
    </main>
  );
}
