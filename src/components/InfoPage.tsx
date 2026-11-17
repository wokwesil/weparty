import Link from "next/link";
import { Backdrop, PoweredBy, Wordmark } from "./Brand";

/** Simple readable page layout for Privacy and Support. */
export function InfoPage({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="relative mx-auto min-h-dvh max-w-2xl px-5 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <Backdrop />
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="tap">
          <Wordmark size="sm" />
        </Link>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/support" className="tap hover:text-white">Support</Link>
          <Link href="/privacy" className="tap hover:text-white">Privacy</Link>
        </nav>
      </header>
      <h1 className="mt-6 font-display text-3xl font-black">{title}</h1>
      {intro && <div className="mt-3 text-muted">{intro}</div>}
      <div className="info-prose mt-8 flex flex-col gap-8">{children}</div>
      <footer className="mt-14 flex justify-center">
        <PoweredBy />
      </footer>
    </main>
  );
}

export function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-white/85">{children}</div>
    </section>
  );
}
