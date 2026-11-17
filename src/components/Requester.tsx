import { Avatar, InstagramLink } from "./Avatar";
import type { SongView } from "@/lib/types";

/** Who picked a song (and how many others backed it). No animation code, so the replay page stays light. */
export function Requester({ song, compact = false }: { song: SongView; compact?: boolean }) {
  if (!song.requester) return <span className="text-xs text-muted">Added by the host</span>;
  const others = song.alsoRequestedBy.length;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <Avatar person={song.requester} size={compact ? 18 : 20} />
      <InstagramLink username={song.requester.instagram} className="truncate" />
      {others > 0 && <span className="shrink-0 text-muted">+{others}</span>}
    </span>
  );
}
