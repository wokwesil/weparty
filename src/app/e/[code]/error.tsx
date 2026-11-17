"use client";
import { Backdrop, Wordmark } from "@/components/Brand";

/** Friendly screen if something breaks while loading a party page. */
export default function PartyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Backdrop />
      <Wordmark />
      <h1 className="font-display text-2xl font-bold">The party page didn&apos;t load</h1>
      <p className="max-w-sm text-muted">This is usually a weak signal or busy Wi-Fi. Your profile and songs are safe.</p>
      <button className="btn btn-primary min-h-12" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
