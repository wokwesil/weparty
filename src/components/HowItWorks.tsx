/**
 * "How it works" steps for first-time visitors: what WeParty is and how to use it,
 * in four numbered steps. Shown on the home page; the join screen uses the compact row.
 * Keep the wording in sync with the Instagram welcome post (weparty/promo).
 */

export type Step = { title: string; body: string; icon: string };

export function guestSteps(maxPicks: number): Step[] {
  return [
    {
      icon: "📲",
      title: "Scan the party QR",
      body: "Scan the code at the party or type the party code. No app download, no sign-up. Just your Instagram handle.",
    },
    {
      icon: "🎵",
      title: `Pick up to ${maxPicks} songs`,
      body: "Search any song and drop it in the party queue. One song gets you in. Add more all night.",
    },
    {
      icon: "❤️",
      title: "Heart your favorites",
      body: "Hearts push songs up the queue. Most hearts plays next. The crowd runs the aux, not one person.",
    },
    {
      icon: "🔥",
      title: "Party, then replay",
      body: "Watch your song climb and hear it drop. After the party, get the replay of every song that played.",
    },
  ];
}

const NUM_COLORS = ["text-pink", "text-violet", "text-cyan", "text-lime"];

export function HowItWorks({ maxPicks }: { maxPicks: number }) {
  const steps = guestSteps(maxPicks);
  return (
    <section aria-labelledby="how-it-works" className="w-full max-w-3xl">
      <p className="text-center text-xs font-bold tracking-[0.35em] text-muted uppercase">New here?</p>
      <h2 id="how-it-works" className="mt-2 text-center font-display text-3xl font-black sm:text-4xl">
        How it <span className="text-gradient">works</span>
      </h2>
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
        {steps.map((s, i) => (
          <li key={s.title} className="glass relative flex gap-4 overflow-hidden rounded-3xl p-5 text-left">
            <span
              className={`font-display text-5xl leading-none font-black ${NUM_COLORS[i % NUM_COLORS.length]}`}
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.3em] text-muted uppercase">Step {i + 1}</p>
              <h3 className="mt-0.5 text-lg font-extrabold leading-snug">
                {s.title} <span aria-hidden>{s.icon}</span>
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Three-step strip for the join screen, sized to keep the join form on one phone screen. */
export function HowItWorksCompact({ maxPicks }: { maxPicks: number }) {
  const items = [
    ["Join with your IG", "text-pink"],
    [`Pick up to ${maxPicks} songs`, "text-violet"],
    ["Heart to move them up", "text-cyan"],
  ] as const;
  return (
    <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="How it works">
      {items.map(([label, color], i) => (
        <li key={label} className="glass flex flex-col items-start gap-1 rounded-2xl px-3 py-2.5">
          <span className={`font-display text-xl leading-none font-black ${color}`} aria-hidden>
            {i + 1}
          </span>
          <span className="text-xs leading-tight font-semibold">{label}</span>
        </li>
      ))}
    </ol>
  );
}
