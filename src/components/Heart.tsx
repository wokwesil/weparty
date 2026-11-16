"use client";
import { useState } from "react";

export function HeartButton({
  voted,
  votes,
  disabled,
  onToggle,
  label,
}: {
  voted: boolean;
  votes: number;
  disabled?: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      aria-pressed={voted}
      aria-label={label ?? (voted ? "Remove heart" : "Heart this song")}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        setPop((p) => p + 1);
        onToggle();
      }}
      className={`flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 transition ${
        voted ? "text-pink" : "text-white/70 hover:text-white"
      } disabled:opacity-40`}
    >
      <svg key={pop} viewBox="0 0 24 24" className={`h-7 w-7 ${pop ? "animate-pop" : ""}`} aria-hidden>
        <path
          d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3.1 4.5 6.9 4.5c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.8 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21Z"
          fill={voted ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
      <span className="text-xs font-bold tabular-nums">{votes}</span>
    </button>
  );
}
