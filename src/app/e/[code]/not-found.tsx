import Link from "next/link";
import { Backdrop, Wordmark } from "@/components/Brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Backdrop />
      <Wordmark />
      <h1 className="font-display text-2xl font-bold">We couldn&apos;t find that party</h1>
      <p className="max-w-sm text-muted">Double-check the QR code or ask the host for the party link.</p>
      <Link href="/" className="btn btn-ghost">Go home</Link>
    </main>
  );
}
