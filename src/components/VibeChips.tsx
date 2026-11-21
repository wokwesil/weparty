/** "Tonight's vibe": the vibes the host picked, shown to guests. */
export function VibeChips({ vibes, className = "" }: { vibes: { id: string; label: string; emoji: string }[]; className?: string }) {
  if (vibes.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold tracking-[0.3em] text-muted uppercase">Tonight&apos;s vibe</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Tonight's vibes">
        {vibes.map((v) => (
          <li key={v.id} className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
            <span aria-hidden>{v.emoji}</span> {v.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
