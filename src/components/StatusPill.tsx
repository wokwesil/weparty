export function StatusPill({ status, open }: { status: string; open: boolean }) {
  if (status === "ended") return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">Ended</span>;
  if (!open) return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-200 uppercase">Requests paused</span>;
  return <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-lime uppercase">● Live</span>;
}
