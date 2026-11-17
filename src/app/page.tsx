import Link from "next/link";
import { Backdrop, Equalizer, PoweredBy, Wordmark } from "@/components/Brand";
import { DancingCrowd } from "@/components/DancingCrowd";
import { JoinByCode } from "./JoinByCode";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <Backdrop />
      <div />
      <section className="flex w-full max-w-xl flex-col items-center text-center">
        <Equalizer className="mb-8 h-10" bars={7} />
        <div className="relative w-full px-2 pb-6 pt-24 sm:pt-28">
          <DancingCrowd className="-inset-x-6 -top-6 bottom-0 opacity-50 sm:-inset-x-40" />
          <div className="relative">
            <h1>
              <Wordmark size="xl" />
            </h1>
            <p className="mt-5 text-xl font-semibold sm:text-2xl">Where We All Control the Vibes.</p>
            <p className="mt-3 text-sm tracking-[0.35em] text-muted uppercase">Scan · Connect · Select · Vote · Party · Replay</p>
          </div>
        </div>
        <div className="mt-12 w-full max-w-sm">
          <JoinByCode />
        </div>
      </section>
      <footer className="flex flex-col items-center gap-4">
        <PoweredBy />
        <Link href="/host" className="tap text-sm text-muted underline-offset-4 hover:text-white hover:underline">
          Hosting a party? Host dashboard →
        </Link>
        <nav className="flex gap-4 text-xs text-muted">
          <Link href="/support" className="tap hover:text-white">Help</Link>
          <Link href="/privacy" className="tap hover:text-white">Privacy</Link>
        </nav>
      </footer>
    </main>
  );
}
