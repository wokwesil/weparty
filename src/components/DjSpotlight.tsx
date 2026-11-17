/* eslint-disable @next/next/no-img-element */
import type { EventPublic } from "@/lib/types";

/** "DJ ___ is spinning": shown on guest screens and the replay when DJ Mode is on. */
export function DjSpotlight({ dj, label = "is spinning", compact = false }: { dj: NonNullable<EventPublic["dj"]>; label?: string; compact?: boolean }) {
  const size = compact ? 32 : 44;
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "glass rounded-2xl px-3 py-2.5"}`}>
      {dj.photoUrl ? (
        <img src={dj.photoUrl} alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-2 ring-cyan/70" />
      ) : (
        <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-cyan/20 text-lg" aria-hidden>
          🎧
        </span>
      )}
      <p className="min-w-0 flex-1 text-sm leading-tight">
        <span className="font-bold">DJ {dj.name}</span> <span className="text-muted">{label}</span>
        {dj.instagram && (
          <a
            href={`https://instagram.com/${encodeURIComponent(dj.instagram)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs font-semibold text-pink"
          >
            @{dj.instagram}
          </a>
        )}
      </p>
    </div>
  );
}
