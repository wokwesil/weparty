import Link from "next/link";
import { Backdrop, Equalizer, PoweredBy, Wordmark } from "@/components/Brand";
import { HowItWorks } from "@/components/HowItWorks";
import { PartyPhoto } from "@/components/PartyPhoto";
import { DEFAULT_SETTINGS } from "@/lib/ranking";
import { JoinByCode } from "./JoinByCode";

const HOST_STEPS = [
  ["Create your party", "Free. Give it a name and you get a party code."],
  ["Put up the QR", "Print it, post it, or show it on a screen."],
  ["Play the crowd's queue", "The queue plays through Offtrack while you party."],
];

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <Backdrop />
      <section className="flex w-full max-w-xl flex-col items-center text-center">
        <Equalizer className="mb-6 h-10" bars={7} />
        <div className="relative w-full px-2 pb-6 pt-16 sm:pt-24">
          <PartyPhoto className="-inset-x-6 -top-6 bottom-0 opacity-60 sm:-inset-x-40" />
          <div className="relative">
            <p className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold tracking-[0.35em] uppercase backdrop-blur">
              Welcome to
            </p>
            <h1 className="mt-3">
              <Wordmark size="xl" />
            </h1>
            <p className="mt-4 font-display text-[clamp(1.5rem,7vw,2.5rem)] leading-tight font-black">
              Where <span className="text-gradient">YOU</span> control the vibes.
            </p>
            <p className="mt-3 text-sm font-extrabold tracking-[0.3em] text-lime uppercase sm:text-base">
              We take back the party.
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-md text-base text-white/85">
          No more one person hogging the aux. Everyone at the party picks songs, hearts the best ones, and the crowd
          decides what plays next.
        </p>
        <div className="mt-8 w-full max-w-sm">
          <JoinByCode />
        </div>
      </section>

      <div className="mt-16 flex w-full justify-center">
        <HowItWorks maxPicks={DEFAULT_SETTINGS.maxPicks} />
      </div>

      <section aria-labelledby="host-steps" className="glass mt-10 w-full max-w-3xl rounded-3xl p-6 text-left">
        <h2 id="host-steps" className="font-display text-xl font-black sm:text-2xl">
          Throwing a party? <span className="text-gradient">Host it free.</span>
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {HOST_STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-black" aria-hidden>
                {i + 1}
              </span>
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/host" className="btn btn-ghost mt-5 w-full sm:w-auto">
          Start hosting →
        </Link>
      </section>

      <footer className="mt-14 flex flex-col items-center gap-4">
        <PoweredBy />
        <nav className="flex gap-4 text-xs text-muted">
          <Link href="/support" className="tap hover:text-white">Help</Link>
          <Link href="/privacy" className="tap hover:text-white">Privacy</Link>
          <Link href="/terms" className="tap hover:text-white">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
