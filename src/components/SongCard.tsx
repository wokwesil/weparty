"use client";
import { motion } from "motion/react";
import { Artwork } from "./Artwork";
import { Avatar, InstagramLink } from "./Avatar";
import { HeartButton } from "./Heart";
import type { SongView } from "@/lib/types";

export function Requester({ song, compact = false }: { song: SongView; compact?: boolean }) {
  if (!song.requester) return <span className="text-xs text-muted">Added by the host</span>;
  const others = song.alsoRequestedBy.length;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <Avatar person={song.requester} size={compact ? 18 : 20} />
      <InstagramLink username={song.requester.instagram} className="truncate" />
      {others > 0 && <span className="shrink-0 text-muted">+{others}</span>}
      {song.boostCents > 0 && <span className="shrink-0 rounded-full bg-lime/15 px-1.5 text-[10px] font-bold text-lime">⚡ Boosted</span>}
    </span>
  );
}

export function SongCard({
  song,
  voted,
  mine,
  onVote,
  showPosition = true,
  canVote = true,
  onOpen,
}: {
  song: SongView;
  voted: boolean;
  mine: boolean;
  onVote: (on: boolean) => void;
  showPosition?: boolean;
  canVote?: boolean;
  onOpen?: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`flex items-center gap-3 rounded-2xl p-2.5 ${mine ? "bg-violet/10 ring-1 ring-violet/40" : "bg-white/[0.03]"}`}
      onClick={onOpen}
    >
      {showPosition && (
        <span className="w-6 shrink-0 text-center font-display text-sm font-bold text-muted tabular-nums">
          {song.locked ? <span aria-label={`Locked by the DJ at number ${song.position}`}>🔒</span> : song.pinned ? "📌" : song.position}
        </span>
      )}
      <Artwork src={song.artworkUrl} size={56} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{song.title}</p>
        <p className="truncate text-sm text-muted">{song.artist}</p>
        <div className="mt-1">
          <Requester song={song} compact />
        </div>
      </div>
      <HeartButton
        voted={voted}
        votes={song.votes}
        disabled={!canVote || mine}
        label={mine ? "You picked this song" : undefined}
        onToggle={() => onVote(!voted)}
      />
    </motion.li>
  );
}

export function NowPlaying({ song, voted, mine, onVote, canVote }: { song: SongView | null; voted: boolean; mine: boolean; onVote: (on: boolean) => void; canVote: boolean }) {
  if (!song) {
    return (
      <div className="glass rounded-3xl p-5 text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-muted uppercase">Now playing</p>
        <p className="mt-2 text-sm text-muted">The DJ hasn&apos;t started the queue yet. Heart your favorites so they play first!</p>
      </div>
    );
  }
  return (
    <motion.div layout className="relative overflow-hidden rounded-3xl p-4">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pink/40 via-violet/30 to-cyan/20" />
      {song.artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={song.artworkUrl} alt="" className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-30 blur-2xl" />
      )}
      <p className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] uppercase">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pink" />
        </span>
        Now playing
      </p>
      <div className="mt-3 flex items-center gap-4">
        <Artwork src={song.artworkUrl} size={88} className="shadow-2xl" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold leading-tight">{song.title}</p>
          <p className="truncate text-white/80">{song.artist}</p>
          <div className="mt-2">
            <Requester song={song} />
          </div>
        </div>
        <HeartButton voted={voted} votes={song.votes} disabled={!canVote || mine} onToggle={() => onVote(!voted)} />
      </div>
    </motion.div>
  );
}
