/* eslint-disable @next/next/no-img-element */
import type { PersonRef } from "@/lib/types";

const COLORS = ["#ff2e88", "#8b5cf6", "#22d3ee", "#f59e0b", "#10b981", "#ef4444"];

export function Avatar({ person, size = 36, ring = false }: { person: Pick<PersonRef, "displayName" | "avatarUrl" | "instagram"> | null; size?: number; ring?: boolean }) {
  const style = { width: size, height: size };
  const ringCls = ring ? "ring-2 ring-pink/70 ring-offset-2 ring-offset-night" : "";
  if (!person) {
    return (
      <span style={style} className={`inline-grid place-items-center rounded-full bg-panel text-[10px] font-bold text-muted ${ringCls}`}>
        HOST
      </span>
    );
  }
  if (person.avatarUrl) {
    return <img src={person.avatarUrl} alt="" style={style} className={`shrink-0 rounded-full object-cover ${ringCls}`} loading="lazy" />;
  }
  const initial = (person.displayName || person.instagram || "?").trim().charAt(0).toUpperCase();
  const color = COLORS[(person.instagram ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      style={{ ...style, background: color, fontSize: size * 0.42 }}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${ringCls}`}
    >
      {initial}
    </span>
  );
}

export function InstagramLink({ username, className = "" }: { username: string; className?: string }) {
  return (
    <a
      href={`https://instagram.com/${encodeURIComponent(username)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-semibold text-pink hover:underline ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      @{username}
    </a>
  );
}
