import { notFound, redirect } from "next/navigation";
import { normalizeSettings } from "@/lib/ranking";
import { effectiveApproval, getEventByCode } from "@/lib/services/events";
import { getGuestPickedAppleIds, getSnapshot } from "@/lib/services/queue";
import { currentGuest } from "@/lib/session";
import type { Song, SongView } from "@/lib/types";
import { PickTracks } from "./PickTracks";

type Props = { params: Promise<{ code: string }> };
export const dynamic = "force-dynamic";
export const metadata = { title: "Pick your party tracks" };

const toSong = (s: SongView): Song => ({
  appleId: s.appleSongId,
  title: s.title,
  artist: s.artist,
  album: s.album,
  artworkUrl: s.artworkUrl,
  durationMs: s.durationMs,
  isrc: null,
  appleUrl: s.appleUrl,
  previewUrl: s.previewUrl,
  explicit: s.explicit,
  genre: s.genre,
});

export default async function PickPage({ params }: Props) {
  const event = await getEventByCode((await params).code);
  if (!event) notFound();
  if (event.status === "ended") redirect(`/e/${event.code}/replay`);
  const guest = await currentGuest(event);
  if (!guest) redirect(`/e/${event.code}`);
  const s = normalizeSettings(event.settings);
  const [picked, snap] = await Promise.all([getGuestPickedAppleIds(guest.id), getSnapshot(event)]);
  // "Already at this party": one tap to back a song someone else picked (no typing needed).
  const mine = new Set(picked);
  const partySongs = [...snap.popular.filter((p) => p.status === "queued"), ...snap.queue]
    .filter((q, i, all) => all.findIndex((x) => x.id === q.id) === i && !mine.has(q.appleSongId))
    .filter((q) => s.allowExplicit || !q.explicit)
    .slice(0, 6)
    .map(toSong);
  return (
    <PickTracks
      code={event.code}
      eventName={event.name}
      minPicks={s.minPicks}
      maxPicks={s.maxPicks}
      alreadyPicked={picked}
      submissionsOpen={event.submissions_open}
      allowExplicit={s.allowExplicit}
      approvalMode={effectiveApproval(s)}
      partySongs={partySongs}
    />
  );
}
