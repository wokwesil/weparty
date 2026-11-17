import type { Sponsor } from "@/lib/types";

/** "Presented by ___" (only appears when the host set a sponsor and the sponsor feature is on). */
export function SponsorBanner({ sponsor }: { sponsor: Sponsor }) {
  const inner = (
    <>
      <span className="text-[10px] font-bold tracking-[0.3em] text-muted uppercase">Presented by</span>
      <span className="font-semibold">{sponsor.name}</span>
    </>
  );
  const cls = "flex items-center justify-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-2 text-sm";
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer sponsored" className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
