export function Equalizer({ className = "", bars = 5 }: { className?: string; bars?: number }) {
  return (
    <span className={`inline-flex items-end gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="w-[3px] h-full origin-bottom rounded-full bg-brand animate-eq"
          style={{ animationDelay: `${(i * 0.17) % 0.9}s`, animationDuration: `${0.8 + (i % 3) * 0.25}s` }}
        />
      ))}
    </span>
  );
}

export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "xl" }) {
  const cls =
    size === "xl"
      ? "text-[clamp(2.25rem,12vw,6rem)]"
      : size === "md"
        ? "text-2xl"
        : "text-lg";
  return (
    <span className={`font-display font-black tracking-tight ${cls}`}>
      <span className="text-gradient whitespace-nowrap [word-spacing:0.18em]">WE PARTY</span>
    </span>
  );
}

export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs uppercase tracking-[0.3em] text-muted ${className}`}>
      Powered by <span className="font-semibold text-white">Offtrack</span>
    </p>
  );
}

export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full bg-pink/25 blur-[120px] animate-float" />
      <div
        className="absolute -right-1/4 top-1/3 h-[60vmax] w-[60vmax] rounded-full bg-violet/25 blur-[120px] animate-float"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="absolute bottom-[-30%] left-1/4 h-[50vmax] w-[50vmax] rounded-full bg-cyan/15 blur-[120px] animate-float"
        style={{ animationDelay: "-9s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(transparent_0,var(--color-night)_75%)]" />
    </div>
  );
}
